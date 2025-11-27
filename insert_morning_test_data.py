import firebase_admin
from firebase_admin import credentials, firestore

# UPDATE this path to your dev service account file
SERVICE_ACCOUNT = "service-account-dev.json"

cred = credentials.Certificate(SERVICE_ACCOUNT)
firebase_admin.initialize_app(cred)

db = firestore.client()

patients = db.collection("patients")

# ----------------------
# MORNING SESSION TEST DATA
# ----------------------
MORNING_DATA = [
    {
        "id": "m1_walkin_ci",
        "name": "M1 Walkin CI",
        "phone": "9000000001",
        "type": "Walk-in",
        "status": "Waiting",
        "tokenNo": 1,
        "slotTime": "2025-11-25T05:00:00Z",
        "appointmentTime": "2025-11-25T05:00:00Z",
        "checkInTime": "2025-11-25T05:01:00Z",
        "consultationTime": 5,
    },
    {
        "id": "m2_booked",
        "name": "M2 Booked",
        "phone": "9000000002",
        "type": "Booked",
        "status": "Booked",
        "tokenNo": 2,
        "slotTime": "2025-11-25T05:05:00Z",
        "appointmentTime": "2025-11-25T05:05:00Z",
        "consultationTime": 5,
    },
    # Slot 3 = EMPTY

    {
        "id": "m4_walkin_booked",
        "name": "M4 Walkin Booked",
        "phone": "9000000004",
        "type": "Walk-in",
        "status": "Booked",
        "tokenNo": 4,
        "slotTime": "2025-11-25T05:15:00Z",
        "appointmentTime": "2025-11-25T05:15:00Z",
        "consultationTime": 5,
    },
    {
        "id": "m5_walkin_ci",
        "name": "M5 Walkin CI",
        "phone": "9000000005",
        "type": "Walk-in",
        "status": "Waiting",
        "tokenNo": 5,
        "slotTime": "2025-11-25T05:20:00Z",
        "appointmentTime": "2025-11-25T05:20:00Z",
        "checkInTime": "2025-11-25T05:20:30Z",
        "consultationTime": 5,
    },
    # Slot 6 = EMPTY
    {
        "id": "m7_booked_ci",
        "name": "M7 Booked CI",
        "phone": "9000000007",
        "type": "Booked",
        "status": "Waiting",
        "tokenNo": 7,
        "slotTime": "2025-11-25T05:30:00Z",
        "appointmentTime": "2025-11-25T05:30:00Z",
        "checkInTime": "2025-11-25T05:29:30Z",
        "consultationTime": 5,
    },
    # Slot 8 = EMPTY
    {
        "id": "m9_booked",
        "name": "M9 Booked",
        "phone": "9000000009",
        "type": "Booked",
        "status": "Booked",
        "tokenNo": 9,
        "slotTime": "2025-11-25T05:40:00Z",
        "appointmentTime": "2025-11-25T05:40:00Z",
        "consultationTime": 5,
    },
    {
        "id": "m10_walkin_ci",
        "name": "M10 Walkin CI",
        "phone": "9000000010",
        "type": "Walk-in",
        "status": "Waiting",
        "tokenNo": 10,
        "slotTime": "2025-11-25T05:45:00Z",
        "appointmentTime": "2025-11-25T05:45:00Z",
        "checkInTime": "2025-11-25T05:46:00Z",
        "consultationTime": 5,
    },
]

for p in MORNING_DATA:
    patients.document(p["id"]).set(p)

print("🌅 Morning session test data uploaded!")
