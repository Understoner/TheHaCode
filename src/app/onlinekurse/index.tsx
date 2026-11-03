import { Redirect } from 'expo-router';

// Die Onlinekurse stehen seit 03.11.2026 auf der Kurse-Seite (Filter
// "On Demand"), nicht mehr auf einer eigenen Seite. Die alte Adresse fuehrt
// dorthin.
export default function OnlinekurseScreen() {
  return <Redirect href="/kurse?art=ondemand" />;
}
