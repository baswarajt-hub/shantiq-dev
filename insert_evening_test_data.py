import firebase_admin
from firebase_admin import credentials, firestore

# UPDATE this path
SERVICE_ACCOUNT = "service-account-dev.json"

cred = credentials.Certificate(SERVICE_ACCOUNT)
firebase_admin.initialize_app(cred)

db = firestore.client()

patients = db.collection("patients")

# ----------------------
# EVENING SESSION TEST DATA
# ----------------------
EVENING_DATA = [
    {
        "id": "e1_walkin_ci",
        "name": "E1 Walkin CI",
        "phone": "9100000001",
        "type": "Walk-in",
        "status": "Waiting",
        "tokenNo": 1,
        "slotTime": "2025-11-25T13:00:00Z",
        "appointmentTime": "2025-11-25T13:00:00Z",
        "checkInTime": "2025-11-25T13:00:20Z",
        "consultationTime": 5,
    },
    {
        "id": "e2_booked",
        "name": "E2 Booked",
        "phone": "9100000002",
        "type": "Booked",
        "status": "Booked",
        "tokenNo": 2,
        "slotTime": "2025-11-25T13:05:00Z",
        "appointmentTime": "2025-11-25T13:05:00Z",
        "consultationTime": 5,
    },
    # Slot 3 empty

    {
        "id": "e4_walkin_booked",
        "name": "E4 Walkin Booked",
        "phone": "9100000004",
        "type": "Walk-in",
        "status": "Booked",
        "tokenNo": 4,
        "slotTime": "2025-11-25T13:15:00Z",
        "appointmentTime": "2025-11-25T13:15:00Z",
        "consultationTime": 5,
    },
    {
        "id": "e5_walkin_ci",
        "name": "E5 Walkin CI",
        "phone": "9100000005",
        "type": "Walk-in",
        "status": "Waiting",
        "tokenNo": 5,
        "slotTime": "2025-11-25T13:20:00Z",
        "appointmentTime": "2025-11-25T13:20:00Z",
        "checkInTime": "2025-11-25T13:20:20Z",
        "consultationTime": 5,
    },
    # Slot 6 empty

    {
        "id": "e7_booked_ci",
        "name": "E7 Booked CI",
        "phone": "9100000007",
        "type": "Booked",
        "status": "Waiting",
        "tokenNo": 7,
        "slotTime": "2025-11-25T13:30:00Z",
        "appointmentTime": "2025-11-25T13:30:00Z",
        "checkInTime": "2025-11-25T13:30:10Z",
        "consultationTime": 5,
    },
    # Slot 8 empty

    {
        "id": "e9_booked",
        "name": "E9 Booked",
        "phone": "9100000009",
        "type": "Booked",
        "status": "Booked",
        "tokenNo": 9,
        "slotTime": "2025-11-25T13:40:00Z",
        "appointmentTime": "2025-11-25T13:40:00Z",
        "consultationTime": 5,
    },
    {
        "id": "e10_walkin_ci",
        "name": "E10 Walkin CI",
        "phone": "9100000010",
        "type": "Walk-in",
        "status": "Waiting",
        "tokenNo": 10,
        "slotTime": "2025-11-25T13:45:00Z",
        "appointmentTime": "2025-11-25T13:45:00Z",
        "checkInTime": "2025-11-25T13:45:20Z",
        "consultationTime": 5,
    },
]

for p in EVENING_DATA:
    patients.document(p["id"]).set(p)

print("🌇 Evening session test data uploaded!")
