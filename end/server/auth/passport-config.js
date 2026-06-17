// server/auth/passport-config.js
const LocalStrategy = require("passport-local").Strategy;
const User = require("../models/User");
const bcrypt = require("bcryptjs");

function initialize(passport) {
  const authenticateUser = async (username, password, done) => {
    try {
      console.log("🔑 Login attempt:", username);

      const user = await User.findOne({ username });
      if (!user) {
        console.log("❌ No user found");
        return done(null, false, { message: "No user with that username" });
      }

      const match = await bcrypt.compare(password, user.password);
      if (match) {
        console.log("✅ Password match");
        return done(null, user);
      } else {
        console.log("❌ Wrong password");
        return done(null, false, { message: "Password incorrect" });
      }
    } catch (err) {
      console.error("🔥 Passport error:", err);
      return done(err);
    }
  };

  passport.use(
    new LocalStrategy({ usernameField: "username" }, authenticateUser)
  );

  // Save only user ID in session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Fetch user from DB on every request
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });

  
}

module.exports = initialize;
