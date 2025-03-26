from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import pandas as pd
import numpy as np
from statsmodels.tsa.arima.model import ARIMA
from sklearn.linear_model import LinearRegression
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
@app.route("/api/dashboard_stats", methods=["GET"])
def get_dashboard_stats():
    try:
        today = pd.Timestamp.now(tz='UTC')
        total_patients = len(patients)

        conditions["START"] = pd.to_datetime(conditions["START"], utc=True)
        conditions["STOP"] = pd.to_datetime(conditions["STOP"], utc=True, errors='coerce')
        active_cases_df = conditions[
            (conditions["START"] <= today) &
            ((conditions["STOP"].isna()) | (conditions["STOP"] >= today))
        ]
        active_cases = active_cases_df.shape[0]
        print(f"Active cases: {active_cases}, NaN STOP: {conditions['STOP'].isna().sum()}")  # Debug

        encounters["START"] = pd.to_datetime(encounters["START"], utc=True)
        encounters["STOP"] = pd.to_datetime(encounters["STOP"], utc=True, errors='coerce')
        active_inpatients = encounters[
            (encounters["ENCOUNTERCLASS"] == "inpatient") &
            (encounters["START"] <= today) &
            ((encounters["STOP"].isna()) | (encounters["STOP"] >= today))
        ]
        hospital_volumes = encounters.groupby("ORGANIZATION").size()
        total_beds = int(sum(hospital_volumes * 0.75))
        occupied_beds = active_inpatients.shape[0]
        bed_occupancy_rate = occupied_beds / total_beds if total_beds > 0 else 0

        severe_diagnoses = ["709044004", "67782005", "442452003", "254837009"]
        merged_df = pd.merge(encounters, claims, left_on="Id", right_on="Id", how="left")
        icu_encounters = merged_df[
            (merged_df["ENCOUNTERCLASS"] == "inpatient") &
            (merged_df["DIAGNOSIS1"].isin(severe_diagnoses)) &
            (merged_df["START"] <= today) &
            ((merged_df["STOP"].isna()) | (merged_df["STOP"] >= today))
        ]
        icu_beds_occupied = icu_encounters.shape[0]

        last_30_days = today - pd.Timedelta(days=30)
        recent_visits = encounters[
            (encounters["START"] >= last_30_days) &
            (encounters["START"] <= today) &
            (encounters["ENCOUNTERCLASS"].isin(["emergency", "outpatient"]))
        ].shape[0]

        resource_strain = (
            (bed_occupancy_rate * 0.5) +
            (icu_beds_occupied / total_beds * 0.3 if total_beds > 0 else 0) +
            (recent_visits / 1000 * 0.2)
        )
        resource_strain = min(max(resource_strain, 0), 1)

        print(f"Beds: {total_beds}, Occupied: {occupied_beds}, ICU: {icu_beds_occupied}, Visits: {recent_visits}")  # Debug

        response_data = {
            "totalPatients": total_patients,
            "activeCases": active_cases,
            "resourceStrain": round(resource_strain, 2)
        }
        return jsonify(response_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
        
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

    result = df.replace({pd.NA: None, float('nan'): None}).to_dict(orient="records")
    return json.dumps(result, cls=NaNEncoder), 200, {'Content-Type': 'application/json'}

@app.route('/api/disease_trends_detailed', methods=['GET'])
def get_disease_trends_detailed():
    try:
        disease_filter = request.args.get('disease', 'All')
        location_filter = request.args.get('location', 'All')
        time_range = request.args.get('timeRange', 'month')

        # Disease mapping
        disease_mapping = {
            'Obesity': 'Body mass index 30+ - obesity (finding)',
            'Employment': 'Full-time employment (finding)',
            'Education': 'Received higher education (finding)',
            'Stress': 'Stress (finding)',
            'Medication Review': 'Medication review due (situation)'
        }
        mapped_disease = disease_mapping.get(disease_filter, disease_filter) if disease_filter != 'All' else 'All'

        # Time range logic
        today = pd.Timestamp(datetime(2025, 3, 18), tz='UTC')
        if time_range == 'week':
            start_date = today - timedelta(days=7)
        elif time_range == 'year':
            start_date = today - timedelta(days=365)
        else:  # month
            start_date = today - timedelta(days=30)

        # Join conditions with patients
        df = conditions.merge(patients[['Id', 'STATE', 'LAT', 'LON']], left_on='PATIENT', right_on='Id', how='left')
        df['START'] = pd.to_datetime(df['START'], utc=True)
        df['STOP'] = df['STOP'].replace('Ongoing', today.strftime('%Y-%m-%d'))
        df['STOP'] = pd.to_datetime(df['STOP'], utc=True)

        # Filter for active conditions
        df = df[
            (df['START'] <= today) & 
            ((df['STOP'].isna()) | (df['STOP'] >= start_date))
        ]

        # Apply filters
        if mapped_disease != 'All':
            df = df[df['DESCRIPTION'] == mapped_disease]
        if location_filter != 'All':
            df = df[df['STATE'] == location_filter]

        # Aggregate trends
        trends = df.groupby([pd.Grouper(key='START', freq='D'), 'STATE', 'LAT', 'LON']).size().reset_index(name='cases')
        trends_data = trends.rename(columns={'START': 'date', 'STATE': 'location'}).to_dict(orient='records')

        # Get top 5 diseases for the dropdown
        top_diseases = df['DESCRIPTION'].value_counts().head(5).index.tolist()
        # Map back to simplified names for the frontend
        reverse_mapping = {v: k for k, v in disease_mapping.items()}
        top_diseases = [reverse_mapping.get(disease, disease) for disease in top_diseases]

        return jsonify({
            "data": {
                "trends": trends_data,
                "diseases": top_diseases  # Add top 5 diseases to the response
            }
        }), 200
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

@app.route('/api/hospital_resources_detailed', methods=['GET'])
def get_hospital_resources_detailed():
    try:
        hospital_filter = request.args.get("hospital", "All")
        date_filter = request.args.get("date")
        enc_df = encounters.copy()
        claims_df = claims.copy()
        patients_df = patients.copy()

        # Apply hospital filter
        if hospital_filter != "All":
            enc_df = enc_df[enc_df["ORGANIZATION"] == hospital_filter]

        # Parse target date
        target_date = pd.to_datetime(date_filter, utc=True) if date_filter else datetime(2025, 3, 17, tzinfo=pytz.UTC)
        enc_df["START"] = pd.to_datetime(enc_df["START"], utc=True)
        max_date = enc_df["START"].max()
        if target_date > max_date:
            target_date = max_date

        # Merge data
        merged_df = pd.merge(enc_df, claims_df, left_on="Id", right_on="Id", how="inner")
        merged_df = pd.merge(merged_df, patients_df, left_on="PATIENT", right_on="Id", how="left", suffixes=("", "_patient"))

        # Visit types
        emergency_visits = enc_df[enc_df["ENCOUNTERCLASS"] == "emergency"].shape[0]
        outpatient_visits = enc_df[enc_df["ENCOUNTERCLASS"] == "outpatient"].shape[0]
        inpatient_encounters = enc_df[enc_df["ENCOUNTERCLASS"] == "inpatient"].copy()

        # Active inpatients
        inpatient_encounters["START"] = pd.to_datetime(inpatient_encounters["START"], utc=True)
        inpatient_encounters["STOP"] = pd.to_datetime(inpatient_encounters["STOP"], utc=True)
        active_inpatients = inpatient_encounters[
            (inpatient_encounters["START"] <= target_date) & 
            ((inpatient_encounters["STOP"].isna()) | (inpatient_encounters["STOP"] >= target_date))
        ]

        # Severe diagnoses
        severe_diagnoses = ["709044004", "67782005", "442452003", "254837009"]
        icu_encounters = merged_df[
            (merged_df["ENCOUNTERCLASS"] == "inpatient") &
            (merged_df["DIAGNOSIS1"].isin(severe_diagnoses)) &
            (pd.to_datetime(merged_df["START"], utc=True) <= target_date) &
            ((pd.to_datetime(merged_df["STOP"], utc=True).isna()) | (pd.to_datetime(merged_df["STOP"], utc=True) >= target_date))
        ]
        icu_beds_occupied = icu_encounters.shape[0]

        # Total beds
        hospital_volumes = enc_df.groupby("ORGANIZATION").size()
        avg_volume = hospital_volumes.mean() if not hospital_volumes.empty else 1
        bed_scaling_factor = 0.5
        total_beds = int(sum(hospital_volumes * bed_scaling_factor)) if hospital_filter == "All" else int(hospital_volumes.get(hospital_filter, avg_volume) * bed_scaling_factor)
        available_beds = total_beds - active_inpatients.shape[0]
        occupancy_rate = (active_inpatients.shape[0] / total_beds) * 100 if total_beds > 0 else 0

        # Staffing
        unique_providers = merged_df["PROVIDERID"].nunique()
        staffing = {
            "Doctors": unique_providers,
            "Nurses": int(unique_providers * 4),
            "Specialists": int(unique_providers * 2),
            "StaffToPatientRatio": (unique_providers + unique_providers * 6) / active_inpatients.shape[0] if active_inpatients.shape[0] > 0 else 0
        }

        # Diagnosis breakdown
        diagnosis_counts = icu_encounters["DIAGNOSIS1"].value_counts().head(5).to_dict()
        diagnosis_breakdown = [{"Diagnosis": k, "Count": int(v)} for k, v in diagnosis_counts.items()]

        # Demographics
        active_inpatients_with_demo = pd.merge(active_inpatients, patients_df, left_on="PATIENT", right_on="Id", how="left")
        age_groups = pd.cut(active_inpatients_with_demo["BIRTHDATE"].apply(lambda x: (target_date - pd.to_datetime(x)).days // 365), 
                            bins=[0, 18, 35, 50, 65, 100], labels=["0-18", "19-35", "36-50", "51-65", "66+"])
        age_dist = age_groups.value_counts().to_dict()
        gender_dist = active_inpatients_with_demo["GENDER"].value_counts().to_dict()

        # Trends (last 30 days)
        start_date = target_date - pd.Timedelta(days=30)
        trends_data = enc_df[(enc_df["START"] >= start_date) & (enc_df["START"] <= target_date)]
        trends = trends_data.groupby(trends_data["START"].dt.date).size().to_dict()
        trends_list = [{"Date": str(date), "Patients": count} for date, count in trends.items()]

        # Advanced forecast with ARIMA
        historical_icu = merged_df[(merged_df["ENCOUNTERCLASS"] == "inpatient") & (merged_df["DIAGNOSIS1"].isin(severe_diagnoses))].groupby(merged_df["START"].dt.date).size()
        if len(historical_icu) > 10:
            model = ARIMA(historical_icu, order=(1, 1, 1))
            model_fit = model.fit()
            forecast = model_fit.forecast(steps=7)
            forecast = [max(0, int(pred)) for pred in forecast]
        else:
            forecast = [icu_beds_occupied] * 7  # Fallback to current value
        forecast_days = [(target_date + pd.Timedelta(days=i)).strftime("%Y-%m-%d") for i in range(1, 8)]
        forecast_data = [{"Day": day, "PredictedICUPatients": pred} for day, pred in zip(forecast_days, forecast)]

        # Response
        utilization = {
            "ICU_Beds_Occupied": icu_beds_occupied,
            "Available_Beds": max(0, available_beds),
            "Total_Beds": total_beds,
            "Occupancy_Rate": round(occupancy_rate, 2),
            "Emergency_Visits": emergency_visits,
            "Outpatient_Visits": outpatient_visits,
            "Staffing": staffing,
            "Diagnosis_Breakdown": diagnosis_breakdown,
            "Demographics": {"Age_Distribution": age_dist, "Gender_Distribution": gender_dist},
            "Trends": trends_list,
            "Forecast": forecast_data
        }

        response = jsonify(utilization)
        response.status_code = 200
        response.headers['Content-Type'] = 'application/json; charset=utf-8'
        return response
    except Exception as e:
        return jsonify({"error": str(e)}), 500@app.route('/api/hospital_resources_detailed', methods=['GET'])
def get_hospital_resources_detailed():
    try:
        hospital_filter = request.args.get("hospital", "All")
        date_filter = request.args.get("date")
        enc_df = encounters.copy()
        claims_df = claims.copy()
        patients_df = patients.copy()

        # Apply hospital filter
        if hospital_filter != "All":
            enc_df = enc_df[enc_df["ORGANIZATION"] == hospital_filter]

        # Parse target date (default to today: March 24, 2025)
        target_date = pd.to_datetime(date_filter, utc=True) if date_filter else pd.Timestamp.now(tz='UTC')
        enc_df["START"] = pd.to_datetime(enc_df["START"], utc=True)
        enc_df["STOP"] = pd.to_datetime(enc_df["STOP"], utc=True, errors='coerce')

        # Merge data for detailed analysis
        merged_df = pd.merge(enc_df, claims_df, left_on="Id", right_on="Id", how="left")
        merged_df = pd.merge(merged_df, patients_df, left_on="PATIENT", right_on="Id", how="left", suffixes=("", "_patient"))

        # Visit types
        visit_types = enc_df["ENCOUNTERCLASS"].value_counts().to_dict()
        emergency_visits = visit_types.get("emergency", 0)
        outpatient_visits = visit_types.get("outpatient", 0)
        inpatient_encounters = enc_df[enc_df["ENCOUNTERCLASS"] == "inpatient"].copy()

        # Active inpatients on target date
        active_inpatients = inpatient_encounters[
            (inpatient_encounters["START"] <= target_date) &
            ((inpatient_encounters["STOP"].isna()) | (inpatient_encounters["STOP"] >= target_date))
        ]

        # ICU Beds (severe diagnoses)
        severe_diagnoses = ["709044004", "67782005", "442452003", "254837009"]  # Example codes
        icu_encounters = merged_df[
            (merged_df["ENCOUNTERCLASS"] == "inpatient") &
            (merged_df["DIAGNOSIS1"].isin(severe_diagnoses)) &
            (merged_df["START"] <= target_date) &
            ((merged_df["STOP"].isna()) | (merged_df["STOP"] >= target_date))
        ]
        icu_beds_occupied = icu_encounters.shape[0]

        # Bed calculations (more realistic estimation)
        if "organizations.csv" in globals():
            total_beds = organizations[organizations["Id"] == hospital_filter]["BEDS"].sum() if hospital_filter != "All" else organizations["BEDS"].sum()
        else:
            hospital_volumes = enc_df.groupby("ORGANIZATION").size()
            avg_volume = hospital_volumes.mean() if not hospital_volumes.empty else 1
            bed_scaling_factor = 0.75  # Adjusted for realism
            total_beds = int(sum(hospital_volumes * bed_scaling_factor)) if hospital_filter == "All" else int(hospital_volumes.get(hospital_filter, avg_volume) * bed_scaling_factor)
        
        available_beds = max(0, total_beds - active_inpatients.shape[0])
        occupancy_rate = (active_inpatients.shape[0] / total_beds) * 100 if total_beds > 0 else 0

        # Staffing (more detailed estimation)
        unique_providers = merged_df["PROVIDERID"].nunique()
        active_patients = active_inpatients.shape[0]
        staffing = {
            "Doctors": max(1, unique_providers // 3),  # Rough estimate
            "Nurses": max(1, int(unique_providers * 1.5)),
            "Specialists": max(1, unique_providers // 5),
            "StaffToPatientRatio": round((unique_providers + unique_providers * 2) / active_patients, 2) if active_patients > 0 else 0
        }

        # Diagnosis breakdown
        diagnosis_counts = icu_encounters["DIAGNOSIS1"].value_counts().head(5).to_dict()
        diagnosis_breakdown = [{"Diagnosis": k, "Count": int(v)} for k, v in diagnosis_counts.items()]

        # Demographics
        active_inpatients_with_demo = pd.merge(active_inpatients, patients_df, left_on="PATIENT", right_on="Id", how="left")
        active_inpatients_with_demo["Age"] = active_inpatients_with_demo["BIRTHDATE"].apply(
            lambda x: (target_date - pd.to_datetime(x, utc=True)).days // 365 if pd.notna(x) else 0
        )
        age_dist = pd.cut(active_inpatients_with_demo["Age"], 
                          bins=[0, 18, 35, 50, 65, 120], 
                          labels=["0-18", "19-35", "36-50", "51-65", "66+"], 
                          right=False).value_counts().to_dict()
        gender_dist = active_inpatients_with_demo["GENDER"].value_counts().to_dict()

        # Trends (last 60 days for more context)
        start_date = target_date - pd.Timedelta(days=60)
        trends_data = enc_df[(enc_df["START"] >= start_date) & (enc_df["START"] <= target_date)]
        trends = trends_data.groupby(trends_data["START"].dt.date).size().to_dict()
        trends_list = [{"Date": str(date), "Patients": int(count)} for date, count in sorted(trends.items())]

        # Enhanced ARIMA forecast
        historical_icu = merged_df[
            (merged_df["ENCOUNTERCLASS"] == "inpatient") & 
            (merged_df["DIAGNOSIS1"].isin(severe_diagnoses))
        ].groupby(merged_df["START"].dt.date).size().reindex(
            pd.date_range(start_date.date(), target_date.date(), freq='D'), fill_value=0
        )
        forecast_steps = 7
        if len(historical_icu) > 10:
            model = ARIMA(historical_icu, order=(1, 1, 1))
            model_fit = model.fit()
            forecast = model_fit.forecast(steps=forecast_steps)
            forecast = [max(0, int(pred)) for pred in forecast]
        else:
            forecast = [icu_beds_occupied] * forecast_steps
        forecast_days = [(target_date + pd.Timedelta(days=i)).strftime("%Y-%m-%d") for i in range(1, forecast_steps + 1)]
        forecast_data = [{"Day": day, "PredictedICUPatients": pred} for day, pred in zip(forecast_days, forecast)]

        # Response
        utilization = {
            "Total_Beds": total_beds,
            "Available_Beds": available_beds,
            "ICU_Beds_Occupied": icu_beds_occupied,
            "Occupancy_Rate": round(occupancy_rate, 2),
            "Emergency_Visits": emergency_visits,
            "Outpatient_Visits": outpatient_visits,
            "Staffing": staffing,
            "Diagnosis_Breakdown": diagnosis_breakdown,
            "Demographics": {
                "Age_Distribution": {k: int(v) for k, v in age_dist.items()},
                "Gender_Distribution": {k: int(v) for k, v in gender_dist.items()}
            },
            "Trends": trends_list,
            "Forecast": forecast_data
        }

        return jsonify(utilization, cls=NaNEncoder)
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