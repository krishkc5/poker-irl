import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";

function App() {
  const [uid, setUid] = useState<string>("loading...");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid);
        console.log("Signed in anonymously:", user.uid);
      } else {
        setUid("not signed in");
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>Poker IRL</h1>
      <p>Firebase connection test</p>
      <p>
        <strong>User UID:</strong> {uid}
      </p>
    </div>
  );
}

export default App;