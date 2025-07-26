import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import type { Express } from "express";

export async function setupLocalAuth(app: Express) {
  // Configure local strategy
  passport.use(new LocalStrategy(
    async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        
        if (!user) {
          return done(null, false, { message: 'Invalid username or password' });
        }
        
        if (!user.password) {
          return done(null, false, { message: 'Password login not enabled for this user' });
        }
        
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
          return done(null, false, { message: 'Invalid username or password' });
        }
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  ));
  
  // Add local login route
  app.post('/api/auth/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      if (err) {
        return res.status(500).json({ message: 'Authentication error' });
      }
      
      if (!user) {
        return res.status(401).json({ message: info?.message || 'Invalid credentials' });
      }
      
      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({ message: 'Login failed' });
        }
        
        return res.json({ success: true, user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        }});
      });
    })(req, res, next);
  });
}

// Function to create admin user
export async function createAdminUser() {
  try {
    // Check if admin already exists
    const existingAdmin = await storage.getUserByUsername('admin');
    
    if (existingAdmin) {
      console.log('Admin user already exists');
      return;
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('password', 10);
    
    // Create admin user
    await storage.createUser({
      username: 'admin',
      password: hashedPassword,
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
    });
    
    console.log('Admin user created successfully');
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}