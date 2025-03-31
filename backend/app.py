from flask import Flask, jsonify, request
from flask_cors import CORS
import json
from flask_caching import Cache
import pandas as pd
import numpy as np
from statsmodels.tsa.arima.model import ARIMA
from sklearn.linear_model import LinearRegression
from datetime import datetime, timedelta
import pytz

app = Flask(__name__)
CORS(app)
cache = Cache(app, config={'CACHE_TYPE': 'simple'})  # Simple in-memory cache

# Load CSV data
patients = pd.read_csv('/Users/harshithathota/Desktop/synthea/output/csv/cleaned_patients.csv')
conditions = pd.read_csv('/Users/harshithathota/Desktop/synthea/output/csv/cleaned_conditions.csv')
encounters = pd.read_csv('/Users/harshithathota/Desktop/synthea/output/csv/cleaned_encounters.csv')
medications = pd.read_csv('/Users/harshithathota/Desktop/synthea/output/csv/cleaned_medications.csv')
observations = pd.read_csv('/Users/harshithathota/Desktop/synthea/output/csv/cleaned_observations.csv')
claims = pd.read_csv('/Users/harshithathota/Desktop/synthea/output/csv/cleaned_claims.csv')
imaging_studies = pd.read_csv('/Users/harshithathota/Desktop/synthea/output/csv/cleaned_imaging_studies.csv')
immunizations = pd.read_csv('/Users/harshithathota/Desktop/synthea/output/csv/cleaned_immunizations.csv')


# Preprocess data at startup to improve performance
patients['AGE'] = pd.to_datetime(patients['BIRTHDATE']).apply(lambda x: (datetime.now() - x).days // 365)
conditions['START'] = pd.to_datetime(conditions['START'], utc=True)
conditions['STOP'] = pd.to_datetime(conditions['STOP'], utc=True, errors='coerce')
observations['DATE'] = pd.to_datetime(observations['DATE'], utc=True)
observations['VALUE'] = pd.to_numeric(observations['VALUE'], errors='coerce')

# Define medical condition keywords (expand this based on your data)
MEDICAL_KEYWORDS = {'disorder', 'disease', 'syndrome', 'infection', 'injury', 'condition'}
CHRONIC_CONDITIONS = set(
    conditions[conditions['STOP'].isna() & conditions['DESCRIPTION'].str.lower().apply(lambda x: any(kw in x.lower() for kw in MEDICAL_KEYWORDS))]
    ['DESCRIPTION'].value_counts().head(5).index
)

# Helper function to apply filters
def apply_filters(df, filters):
    if "gender" in filters and filters["gender"] != "All":
        df = df[df["GENDER"] == filters["gender"]]
    if "age" in filters:
        df = df[df["AGE"] == int(filters["age"])]
    return df

# Custom JSON encoder to handle NaN
class NaNEncoder(json.JSONEncoder):
    def default(self, obj):
        if pd.isna(obj):
            return None
        return super().default(obj)
@app.route("/api/dashboard_stats", methods=["GET"])
def get_dashboard_stats():
    try:
        # Total Patients: Count unique patients
        total_patients = len(patients)

        # Active Encounters: Count encounters ongoing as of today
        today = pd.Timestamp.now(tz="UTC")
        encounters["START"] = pd.to_datetime(encounters["START"], utc=True)
        encounters["STOP"] = pd.to_datetime(encounters["STOP"], utc=True, errors="coerce")
        active_encounters_df = encounters[
            (encounters["START"] <= today) &
            ((encounters["STOP"].isna()) | (encounters["STOP"] >= today))
        ]
        active_encounters = active_encounters_df.shape[0]

        # Total Claims Cost: Sum of TOTAL_CLAIM_COST from encounters.csv
        total_claims_cost = encounters["TOTAL_CLAIM_COST"].sum()

        # Debug prints to verify calculations
        print(f"Total Patients: {total_patients}")
        print(f"Active Encounters: {active_encounters}")
        print(f"Total Claims Cost: {total_claims_cost}")

        response_data = {
            "totalPatients": int(total_patients),
            "activeEncounters": int(active_encounters),
            "totalClaimsCost": round(float(total_claims_cost), 2)
        }
        return jsonify(response_data)
    except Exception as e:
        print(f"Error in get_dashboard_stats: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/disease_trends', methods=['GET'])
@cache.cached(timeout=300)
def get_disease_trends():
    try:
        condition_type = request.args.get('condition_type', 'All')
        selected_conditions = request.args.getlist('conditions')
        year_range = int(request.args.get('year_range', 10))

        df = conditions.merge(patients[['Id', 'GENDER', 'AGE']], left_on='PATIENT', right_on='Id', how='left')
        
        # Filter to medical conditions only
        df = df[df['DESCRIPTION'].str.lower().apply(lambda x: any(kw in x.lower() for kw in MEDICAL_KEYWORDS))]

        # Filter by condition type
        df['IS_CHRONIC'] = df['DESCRIPTION'].isin(CHRONIC_CONDITIONS) | df['STOP'].isna()
        if condition_type == 'Chronic':
            df = df[df['IS_CHRONIC']]
        elif condition_type == 'Acute':
            df = df[~df['IS_CHRONIC']]

        # Apply year range
        current_year = datetime.now(pytz.UTC).year
        min_year = current_year - year_range
        df = df[df['START'].dt.year >= min_year]

        # Default to top 2 medical conditions if none selected
        if not selected_conditions:
            top_conditions = df['DESCRIPTION'].value_counts().head(2).index.tolist()
            selected_conditions = top_conditions

        # 1. Trends Data (sorted by year)
        trends_df = df[df['DESCRIPTION'].isin(selected_conditions)].groupby([df['START'].dt.year, 'DESCRIPTION']).size().reset_index(name='count')
        trends_df.columns = ['year', 'condition', 'count']
        trends_df = trends_df.sort_values('year')  # Sort by year
        trends_data = trends_df.to_dict(orient='records')

        # 2. Heatmap Data
        age_bins = [0, 18, 35, 50, 65, max(df['AGE'].max(), 120)]
        age_labels = ['0-18', '19-35', '36-50', '51-65', '65+']
        df['age_group'] = pd.cut(df['AGE'], bins=age_bins, labels=age_labels, right=False)
        heatmap_df = df.groupby(['age_group', 'GENDER', 'DESCRIPTION']).size().reset_index(name='count')
        heatmap_data = heatmap_df.to_dict(orient='records')

        # 3. Top Conditions
        total_patients = patients['Id'].nunique()
        top_conditions_df = df['DESCRIPTION'].value_counts().head(5).reset_index()
        top_conditions_df.columns = ['condition', 'count']
        top_conditions_df['percentage'] = (top_conditions_df['count'] / total_patients * 100).round(2)
        top_conditions = top_conditions_df.to_dict(orient='records')

        # 4. HbA1c Trend
        obs_df = observations[observations['DESCRIPTION'] == 'Hemoglobin A1c/Hemoglobin.total in Blood'].copy()
        obs_df = obs_df[obs_df['DATE'].dt.year >= min_year]
        obs_trend_df = obs_df.groupby(obs_df['DATE'].dt.year)['VALUE'].mean().reset_index()
        obs_trend_df = obs_trend_df.sort_values('DATE')  # Sort by year
        obs_trend_data = obs_trend_df.rename(columns={'DATE': 'year', 'VALUE': 'avg_hba1c'}).to_dict(orient='records')

        return json.dumps({
            'trends': trends_data,
            'heatmap': heatmap_data,
            'top_conditions': top_conditions,
            'hba1c_trend': obs_trend_data
        }, cls=NaNEncoder), 200, {'Content-Type': 'application/json'}
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Placeholder for other endpoints (e.g., /api/patients)
@app.route('/api/patients', methods=['GET'])
def get_patients():
    try:
        df = patients.copy()
        df_conditions_count = conditions.groupby('PATIENT')['DESCRIPTION'].count().reset_index(name='condition_count')
        df_conditions_top = conditions.groupby('PATIENT')['DESCRIPTION'].agg(lambda x: x.value_counts().index[0]).reset_index(name='top_condition')
        df_medications = pd.read_csv('/Users/harshithathota/Desktop/synthea/output/csv/cleaned_medications.csv').groupby('PATIENT')['DISPENSES'].sum().reset_index(name='medication_count')
        
        df = df.merge(df_conditions_count, left_on='Id', right_on='PATIENT', how='left').fillna({'condition_count': 0})
        df = df.merge(df_conditions_top, left_on='Id', right_on='PATIENT', how='left').fillna({'top_condition': 'None'})
        df = df.merge(df_medications, left_on='Id', right_on='PATIENT', how='left').fillna({'medication_count': 0})
        
        df['HRI'] = (df['condition_count'] * 0.4 + df['HEALTHCARE_EXPENSES'] / 10000 * 0.4 + df['medication_count'] * 0.2)
        max_hri = df['HRI'].max()
        df['HRI'] = (df['HRI'] / max_hri * 100).clip(upper=100)

        result = df[['Id', 'GENDER', 'RACE', 'AGE', 'CITY', 'HEALTHCARE_EXPENSES', 'condition_count', 'medication_count', 'HRI', 'top_condition']].to_dict(orient='records')
        
        return json.dumps(result, cls=NaNEncoder), 200, {'Content-Type': 'application/json'}
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/top_diseases', methods=['GET'])
def get_top_diseases():
    try:
        disease_filter = request.args.get('disease', 'All')
        location_filter = request.args.get('location', 'All')
        time_range = request.args.get('timeRange', 'month')

        # Determine time ranges
        today = pd.Timestamp('2025-03-17', tz='UTC')  # Fixed date as per your setup
        if time_range == 'week':
            this_year_start = today - timedelta(days=7)
            last_year_start = today - timedelta(days=14)
        elif time_range == 'year':
            this_year_start = today - timedelta(days=365)
            last_year_start = today - timedelta(days=730)
        else:  # month
            this_year_start = today - timedelta(days=30)
            last_year_start = today - timedelta(days=60)

        # Join conditions with patients to get STATE
        df = conditions.merge(patients[['Id', 'STATE']], left_on='PATIENT', right_on='Id', how='left')
        df['START'] = pd.to_datetime(df['START'], utc=True)
        df['STOP'] = df['STOP'].replace('Ongoing', pd.Timestamp('2025-03-17', tz='UTC'))
        df['STOP'] = pd.to_datetime(df['STOP'], utc=True)

        # Apply filters
        if disease_filter != 'All':
            df = df[df['DESCRIPTION'] == disease_filter]
        if location_filter != 'All':
            df = df[df['STATE'] == location_filter]

        # This period: active conditions within the last X days
        this_year_df = df[
            (df['START'] <= today) & 
            ((df['STOP'].isna()) | (df['STOP'] >= this_year_start))
        ]
        this_year_counts = this_year_df['DESCRIPTION'].value_counts().head(5).to_dict()

        # Last period: active conditions in the prior period, excluding current period overlap
        last_year_df = df[
            (df['START'] < this_year_start) & 
            ((df['STOP'].isna()) | (df['STOP'] >= last_year_start)) & 
            ((df['STOP'].isna()) | (df['STOP'] < this_year_start))
        ]
        last_year_counts = last_year_df['DESCRIPTION'].value_counts().to_dict()

        # Combine data
        top_diseases = [
            {
                'name': disease,
                'currentYear': this_year_counts.get(disease, 0),
                'lastYear': last_year_counts.get(disease, 0),
            }
            for disease in set(this_year_counts.keys()).union(last_year_counts.keys())
        ]
        top_diseases = sorted(top_diseases, key=lambda x: x['currentYear'], reverse=True)[:5]

        return create_response(data=top_diseases)
    except Exception as e:
        return create_response(error=str(e), status=500)

# Helper function
def create_response(data=None, error=None, status=200):
    return jsonify({"data": data, "error": error}), status

@app.route('/api/medications', methods=['GET'])
def get_medications():
    try:
        return jsonify(medications.head(50).to_dict(orient="records"))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/immunizations', methods=['GET'])
def get_immunizations():
    try:
        return jsonify(immunizations.head(50).to_dict(orient="records"))
    except Exception as e:
        return jsonify({"error": str(e)}), 500



@app.route('/api/patient_demographics', methods=['GET'])
def get_patient_demographics():
    try:
        demographics = {
            "gender_distribution": patients["GENDER"].value_counts().to_dict(),
            "age_distribution": patients["AGE"].value_counts().to_dict(),
            "race_distribution": patients["RACE"].value_counts().to_dict()
        }
        return jsonify(demographics)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/medication_trends', methods=['GET'])
def get_medication_trends():
    try:
        medication_counts = medications["DESCRIPTION"].value_counts().to_dict()
        return jsonify(medication_counts)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/resource_utilization', methods=['GET'])
def get_resource_utilization():
    try:
        year_filter = request.args.get('year', 'All')
        encounter_class = request.args.get('encounterClass', 'All')

        # Prepare encounters DataFrame
        enc_df = encounters.copy()
        enc_df['START'] = pd.to_datetime(enc_df['START'], errors='coerce', utc=True)

        # Apply filters
        if year_filter != 'All':
            enc_df = enc_df[enc_df['START'].dt.year == int(year_filter)]
        if encounter_class != 'All':
            enc_df = enc_df[enc_df['ENCOUNTERCLASS'] == encounter_class]

        # 1. Top Organizations by Encounter Count and Cost
        top_orgs = (enc_df.groupby('ORGANIZATION')
                   .agg({'Id': 'count', 'TOTAL_CLAIM_COST': 'sum'})
                   .rename(columns={'Id': 'count'})
                   .sort_values('count', ascending=False)
                   .head(5))
        top_orgs['ORG_SHORT'] = top_orgs.index.str[:8] + '...'  # Shortened name for display
        top_orgs_data = top_orgs.reset_index().to_dict(orient='records')

        # 2. Encounter Types Distribution
        encounter_types = (enc_df.groupby('ENCOUNTERCLASS')
                         .agg({'Id': 'count', 'TOTAL_CLAIM_COST': 'sum', 'BASE_ENCOUNTER_COST': 'sum'})
                         .rename(columns={'Id': 'count', 'TOTAL_CLAIM_COST': 'total_cost', 'BASE_ENCOUNTER_COST': 'base_cost'}))
        encounter_types['avg_cost_per_encounter'] = (encounter_types['total_cost'] / encounter_types['count']).round(2)
        encounter_types_data = encounter_types.reset_index().rename(columns={'ENCOUNTERCLASS': 'class'}).to_dict(orient='records')

        # 3. Top Medications by Usage and Cost
        meds_df = medications.copy()
        if year_filter != 'All':
            meds_df['START'] = pd.to_datetime(meds_df['START'], errors='coerce', utc=True)
            meds_df = meds_df[meds_df['START'].dt.year == int(year_filter)]
        top_meds = (meds_df.groupby('DESCRIPTION')
                   .agg({'DISPENSES': 'sum', 'TOTALCOST': 'sum', 'PATIENT': 'nunique'})
                   .rename(columns={'DISPENSES': 'dispenses', 'TOTALCOST': 'total_cost', 'PATIENT': 'patients_count'})
                   .sort_values('dispenses', ascending=False)
                   .head(5))
        top_meds['avg_cost_per_dispense'] = (top_meds['total_cost'] / top_meds['dispenses']).round(2)
        top_meds_data = top_meds.reset_index().rename(columns={'DESCRIPTION': 'medication'}).to_dict(orient='records')

        # 4. Monthly Trends
        enc_df['month'] = enc_df['START'].dt.to_period('M').astype(str)
        monthly_trends = (enc_df.groupby('month')
                        .agg({'Id': 'count', 'TOTAL_CLAIM_COST': 'sum'})
                        .rename(columns={'Id': 'encounters', 'TOTAL_CLAIM_COST': 'total_cost'})
                        .sort_index())
        monthly_trends['cost_per_encounter'] = (monthly_trends['total_cost'] / monthly_trends['encounters']).round(2)
        monthly_trends_data = monthly_trends.reset_index().to_dict(orient='records')

        # 5. Resource Metrics
        resource_metrics = {
            'total_encounters': int(enc_df['Id'].count()),
            'total_claims_cost': float(enc_df['TOTAL_CLAIM_COST'].sum()),
            'avg_cost_per_encounter': float(enc_df['TOTAL_CLAIM_COST'].mean().round(2)) if not enc_df.empty else 0,
            'payer_coverage_percentage': float((enc_df['PAYER_COVERAGE'].sum() / enc_df['TOTAL_CLAIM_COST'].sum() * 100).round(2)) if enc_df['TOTAL_CLAIM_COST'].sum() > 0 else 0
        }

        # 6. Available Filters
        available_years = sorted(enc_df['START'].dt.year.unique().tolist())
        encounter_classes = sorted(enc_df['ENCOUNTERCLASS'].unique().tolist())

        response_data = {
            'top_organizations': top_orgs_data,
            'encounter_types': encounter_types_data,
            'top_medications': top_meds_data,
            'monthly_trends': monthly_trends_data,
            'resource_metrics': resource_metrics,
            'filters': {
                'available_years': [str(year) for year in available_years],
                'encounter_classes': encounter_classes
            }
        }
        return json.dumps(response_data, cls=NaNEncoder), 200, {'Content-Type': 'application/json'}

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Optional endpoint for hospital list
@app.route('/api/hospitals', methods=['GET'])
def get_hospitals():
    try:
        hospitals = ["All"] + sorted(encounters["ORGANIZATION"].unique().tolist())
        return jsonify(hospitals)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)