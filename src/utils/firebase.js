import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDpqGGNIZF70btqPepBRx88hjfwdfze3jY",
    authDomain: "lifeos-482319.firebaseapp.com",
    projectId: "lifeos-482319",
    storageBucket: "lifeos-482319.firebasestorage.app",
    messagingSenderId: "133769482062",
    appId: "1:133769482062:web:11d3954bd799b18507981f"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase Auth with persistence
export const auth = getAuth(app)

export default app
