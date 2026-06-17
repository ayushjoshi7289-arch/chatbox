import { createContext, useContext } from "react";

const AuthContextInternal = createContext(null);

export const useAuth = () => useContext(AuthContextInternal);

export default AuthContextInternal;