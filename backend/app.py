from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import json
from datetime import datetime, timedelta
import pytz

app = Flask(__name__)
CORS(app)

# Load CSV data
patients = pd.read_csv('/Users/harshithathota/Desktop/synthea/output/csv/cleaned_patients.csv')
conditions = pd.read_csv('/Users/harshithathota/Desktop/synthea/output/csv/cleaned_conditions.csv')
encounters = pd.read_csv('/Users/harshithathota/Desktop/synthea/output/csv/cleaned_encounters.csv')
medications = pd.read_csv('/Users/harshithathota/Desktop/synthea/output/csv/cleaned_medications.csv')
observations = pd.read_csv('/Users/harshithathota/Desktop/synthea/output/csv/cleaned_observations.csv')
claims = pd.read_csv('/Users/harshithathota/Desktop/synthea/output/csv/cleaned_claims.csv')
imaging_studies = pd.read_csv('/Users/harshithathota/Desktop/synthea/output/csv/cleaned_imaging_studies.csv')
immunizations = pd.read_csv('/Users/harshithathota/Desktop/synthea/output/csv/cleaned_immunizations.csv')

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

@app.route('/api/patients', methods=['GET'])
def get_patients():
    gender = request.args.get("gender")
    age_range = request.args.get("age")
    race = request.args.get("race")
    df = patients.copy()

    if gender and gender != "All":
        df = df[df["GENDER"] == gender]
    if race and race != "All":
        df = df[df["RACE"] == race]
    if age_range and age_range != "All":
        if '-' in age_range:
            min_age, max_age = map(int, age_range.split('-'))
            df['AGE'] = pd.to_datetime(df['BIRTHDATE']).apply(
                lambda x: (pd.Timestamp.now() - x).days // 365
            )
            df = df[(df["AGE"] >= min_age) & (df["AGE"] <= max_age)]
        elif '+' in age_range:
            min_age = int(age_range.replace('+', ''))
            df['AGE'] = pd.to_datetime(df['BIRTHDATE']).apply(
                lambda x: (pd.Timestamp.now() - x).days // 365
            )
            df = df[df["AGE"] >= min_age]

    result = df.head(50).replace({pd.NA: None, float('nan'): None}).to_dict(orient="records")
    return json.dumps(result, cls=NaNEncoder), 200, {'Content-Type': 'application/json'}

@app.route('/api/disease_trends_detailed', methods=['GET'])
def get_disease_trends_detailed():
    try:
        disease_filter = request.args.get('disease', 'All')
        location_filter = request.args.get('location', 'All')
        time_range = request.args.get('timeRange', 'month')

        # Determine time range
        today = pd.Timestamp('2025-03-17', tz='UTC')  # Fixed date as per your setup
        if time_range == 'week':
            start_date = today - timedelta(days=7)
        elif time_range == 'year':
            start_date = today - timedelta(days=365)
        else:  # month
            start_date = today - timedelta(days=30)

        # Join conditions with patients to get STATE
        df = conditions.merge(patients[['Id', 'STATE']], left_on='PATIENT', right_on='Id', how='left')
        df['START'] = pd.to_datetime(df['START'], utc=True)
        df['STOP'] = df['STOP'].replace('Ongoing', pd.Timestamp('2025-03-17', tz='UTC'))
        df['STOP'] = pd.to_datetime(df['STOP'], utc=True)

        # Filter for conditions active within the time range
        df = df[
            (df['START'] <= today) & 
            ((df['STOP'].isna()) | (df['STOP'] >= start_date))
        ]

        # Apply filters
        if disease_filter != 'All':
            df = df[df['DESCRIPTION'] == disease_filter]
        if location_filter != 'All':
            df = df[df['STATE'] == location_filter]

        # Aggregate by date and location
        trends = df.groupby([pd.Grouper(key='START', freq='D'), 'STATE']).size().reset_index(name='cases')
        trends_data = trends.rename(columns={'START': 'date', 'STATE': 'location'}).to_dict(orient='records')

        return create_response(data={'trends': trends_data})
    except Exception as e:
        return create_response(error=str(e), status=500)

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

@app.route('/api/hospital_resources', methods=['GET'])
def get_hospital_resources():
    try:
        utilization = {
            "ICU_Beds_Occupied": 78,
            "Total_Beds": 100
        }
        return jsonify(utilization)
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

@app.route('/api/hospital_resources_detailed', methods=['GET'])
def get_hospital_resources_detailed():
    try:
        hospital_filter = request.args.get("hospital")
        date_filter = request.args.get("date")
        enc_df = encounters.copy()
        claims_df = claims.copy()

        if hospital_filter and hospital_filter != "All":
            enc_df = enc_df[enc_df["ORGANIZATION"] == hospital_filter]

        if date_filter:
            target_date = pd.to_datetime(date_filter, utc=True)
        else:
            target_date = datetime(2025, 3, 17, tzinfo=pytz.UTC)

        merged_df = pd.merge(enc_df, claims_df, left_on="Id", right_on="Id", how="inner")

        emergency_visits = enc_df[enc_df["ENCOUNTERCLASS"] == "emergency"].shape[0]
        outpatient_visits = enc_df[enc_df["ENCOUNTERCLASS"] == "outpatient"].shape[0]
        inpatient_encounters = enc_df[enc_df["ENCOUNTERCLASS"] == "inpatient"].copy()

        inpatient_encounters["START"] = pd.to_datetime(inpatient_encounters["START"], utc=True)
        inpatient_encounters["STOP"] = pd.to_datetime(inpatient_encounters["STOP"], utc=True)

        active_inpatients = inpatient_encounters[
            (inpatient_encounters["START"] <= target_date) & 
            ((inpatient_encounters["STOP"].isna()) | (inpatient_encounters["STOP"] >= target_date))
        ].shape[0]

        severe_diagnoses = ["254837009", "10509002", "702927004"]
        icu_encounters = merged_df[
            (merged_df["ENCOUNTERCLASS"] == "inpatient") &
            (merged_df["TOTAL_CLAIM_COST"] > merged_df["TOTAL_CLAIM_COST"].median()) &
            (merged_df["DIAGNOSIS1"].isin(severe_diagnoses)) &
            (pd.to_datetime(merged_df["START"], utc=True) <= target_date) &
            ((pd.to_datetime(merged_df["STOP"], utc=True).isna()) | (pd.to_datetime(merged_df["STOP"], utc=True) >= target_date))
        ]
        icu_beds_occupied = icu_encounters.shape[0]

        total_beds_per_hospital = 100
        unique_hospitals = enc_df["ORGANIZATION"].nunique() if hospital_filter == "All" else 1
        total_beds = total_beds_per_hospital * unique_hospitals
        available_beds = total_beds - active_inpatients

        unique_providers = merged_df["PROVIDERID"].nunique()
        total_encounters = enc_df.shape[0]
        staffing = {
            "Doctors": unique_providers,
            "Nurses": max(20, total_encounters // 5),
            "Specialists": max(10, unique_providers // 2)
        }

        utilization = {
            "ICU_Beds_Occupied": icu_beds_occupied,
            "Available_Beds": max(0, available_beds),
            "Total_Beds": total_beds,
            "Emergency_Visits": emergency_visits,
            "Outpatient_Visits": outpatient_visits,
            "Staffing": staffing
        }

        response = jsonify(utilization)
        response.status_code = 200
        response.headers['Content-Type'] = 'application/json; charset=utf-8'
        return response
    except Exception as e:
        response = jsonify({"error": str(e)})
        response.status_code = 500
        return response

@app.route('/api/hospitals', methods=['GET'])
def get_hospitals():
    try:
        hospitals = sorted(encounters["ORGANIZATION"].unique().tolist())
        response = jsonify(hospitals)
        response.status_code = 200
        return response
    except Exception as e:
        response = jsonify({"error": str(e)})
        response.status_code = 500
        return response

if __name__ == '__main__':
    app.run(debug=True)