import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { storage } from "./storage";
import type { Express, RequestHandler } from "express";
import { z } from "zod";

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
  
  // Add local logout route
  app.post('/api/auth/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: 'Logout failed' });
      }
      res.json({ success: true });
    });
  });

  // User registration endpoint
  const registerSchema = z.object({
    username: z.string().min(3, 'Username must be at least 3 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const validatedData = registerSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }

      const existingEmail = await storage.getUserByEmail(validatedData.email);
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(validatedData.password, 12);

      // Create user
      const newUser = await storage.createUser({
        username: validatedData.username,
        email: validatedData.email,
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
      });

      // Log user in automatically
      req.logIn(newUser, (err) => {
        if (err) {
          return res.status(500).json({ message: 'Registration successful but login failed' });
        }
        
        return res.status(201).json({ 
          success: true, 
          message: 'Registration successful',
          user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
          }
        });
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: error.errors 
        });
      }
      
      console.error('Registration error:', error);
      return res.status(500).json({ message: 'Registration failed' });
    }
  });

  // Password reset request
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists for security
        return res.json({ message: 'If that email exists, a reset link has been sent' });
      }

      // Generate reset token (in production, use a proper token service)
      const resetToken = jwt.sign(
        { userId: user.id, type: 'password-reset' },
        process.env.SESSION_SECRET || 'fallback-secret',
        { expiresIn: '1h' }
      );

      // In production, send email with reset link
      console.log(`Password reset link for ${email}: /reset-password?token=${resetToken}`);
      
      return res.json({ 
        message: 'If that email exists, a reset link has been sent',
        // In development, return the token
        ...(process.env.NODE_ENV === 'development' && { resetToken })
      });

    } catch (error) {
      console.error('Password reset error:', error);
      return res.status(500).json({ message: 'Password reset failed' });
    }
  });

  // Password reset confirmation
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }

      // Verify token
      const decoded = jwt.verify(
        token, 
        process.env.SESSION_SECRET || 'fallback-secret'
      ) as any;

      if (decoded.type !== 'password-reset') {
        return res.status(400).json({ message: 'Invalid token type' });
      }

      // Get user
      const user = await storage.getUser(decoded.userId);
      if (!user) {
        return res.status(400).json({ message: 'User not found' });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      await storage.updateUser(user.id, { password: hashedPassword });

      return res.json({ message: 'Password reset successful' });

    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(400).json({ message: 'Invalid or expired token' });
      }
      
      console.error('Password reset confirmation error:', error);
      return res.status(500).json({ message: 'Password reset failed' });
    }
  });

  // Change password (for logged-in users)
  app.post('/api/auth/change-password', isAuthenticatedLocal, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current and new passwords are required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
      }

      // Get user with password
      const user = await storage.getUser(userId);
      if (!user || !user.password) {
        return res.status(400).json({ message: 'User not found or password not set' });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      await storage.updateUser(userId, { password: hashedNewPassword });

      return res.json({ message: 'Password changed successfully' });

    } catch (error) {
      console.error('Change password error:', error);
      return res.status(500).json({ message: 'Password change failed' });
    }
  });
}

// Enhanced authentication middleware
export const isAuthenticatedLocal: RequestHandler = (req: any, res, next) => {
  if (req.isAuthenticated() && req.user) {
    return next();
  }
  
  return res.status(401).json({ message: 'Authentication required' });
};

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