import { useContext } from "react";
import AuthContext from "./AuthContextInternal";

export default function useAuth() {
  return useContext(AuthContext);
}

