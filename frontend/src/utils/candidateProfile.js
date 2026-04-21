import axios from "axios";

export async function getCandidateProfile() {
  const res = await axios.get("/api/candidates/profile");
  return res.data.candidate;
}
