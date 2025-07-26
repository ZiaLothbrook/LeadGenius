import { insertUserSchema, insertProspectSchema } from '../schema';

describe('Schema Validation', () => {
  describe('User Schema', () => {
    it('should validate a valid user', () => {
      const validUser = {
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      };

      const result = insertUserSchema.safeParse(validUser);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validUser);
      }
    });

    it('should reject user with invalid email', () => {
      const invalidUser = {
        username: 'testuser',
        email: 'invalid-email',
        firstName: 'Test',
        lastName: 'User',
      };

      const result = insertUserSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
    });

    it('should reject user without required fields', () => {
      const incompleteUser = {
        email: 'test@example.com',
      };

      const result = insertUserSchema.safeParse(incompleteUser);
      expect(result.success).toBe(false);
    });
  });

  describe('Prospect Schema', () => {
    it('should validate a valid prospect', () => {
      const validProspect = {
        userId: 'user-123',
        name: 'John Doe',
        title: 'CEO',
        company: 'Test Corp',
        industry: 'Technology',
        location: 'San Francisco, CA',
        email: 'john@testcorp.com',
        phone: '+1-555-0123',
        linkedinUrl: 'https://linkedin.com/in/johndoe',
        dataQuality: 0.95,
        verified: true,
        priority: 'high',
        notes: 'Potential high-value prospect',
      };

      const result = insertProspectSchema.safeParse(validProspect);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('John Doe');
        expect(result.data.email).toBe('john@testcorp.com');
      }
    });

    it('should reject prospect with invalid email', () => {
      const invalidProspect = {
        userId: 'user-123',
        name: 'John Doe',
        email: 'invalid-email',
      };

      const result = insertProspectSchema.safeParse(invalidProspect);
      expect(result.success).toBe(false);
    });

    it('should reject prospect without required fields', () => {
      const incompleteProspect = {
        name: 'John Doe',
        // Missing userId
      };

      const result = insertProspectSchema.safeParse(incompleteProspect);
      expect(result.success).toBe(false);
    });

    it('should validate optional fields', () => {
      const minimalProspect = {
        userId: 'user-123',
        name: 'Jane Smith',
      };

      const result = insertProspectSchema.safeParse(minimalProspect);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Jane Smith');
        expect(result.data.userId).toBe('user-123');
      }
    });
  });
});