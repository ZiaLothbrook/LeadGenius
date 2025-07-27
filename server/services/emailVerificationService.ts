import { zerobounceService } from "./zerobounceService";

export interface EmailVerificationResult {
  email: string;
  isValid: boolean;
  deliverability: 'deliverable' | 'undeliverable' | 'risky' | 'unknown';
  confidence: number; // 0-100
  reason?: string;
  details: {
    syntaxValid: boolean;
    domainExists: boolean;
    mxRecordExists: boolean;
    smtpValid: boolean;
    disposable: boolean;
    role: boolean; // info@, admin@, etc.
    spamTrap: boolean;
    toxic: boolean;
  };
  provider?: string; // gmail, outlook, yahoo, etc.
  riskScore: number; // 0-100 (higher = riskier)
}

class EmailVerificationService {
  
  /**
   * Verify a single email address for deliverability
   */
  async verifyEmail(email: string): Promise<EmailVerificationResult> {
    try {
      console.log(`🔍 Verifying email: ${email}`);
      
      // First, perform basic syntax validation
      const syntaxResult = this.validateEmailSyntax(email);
      if (!syntaxResult.isValid) {
        return {
          email,
          isValid: false,
          deliverability: 'undeliverable',
          confidence: 0,
          reason: syntaxResult.reason,
          details: {
            syntaxValid: false,
            domainExists: false,
            mxRecordExists: false,
            smtpValid: false,
            disposable: false,
            role: false,
            spamTrap: false,
            toxic: false,
          },
          riskScore: 100
        };
      }

      // Use ZeroBounce for comprehensive verification
      try {
        const zerobounceResult = await zerobounceService.verifyEmail(email);
        
        if (zerobounceResult.success) {
          return this.mapZeroBounceResult(email, zerobounceResult.data);
        }
      } catch (error) {
        console.warn(`⚠️ ZeroBounce verification failed for ${email}, falling back to basic verification:`, error);
      }

      // Fallback to basic verification
      const basicResult = await this.performBasicVerification(email);
      return basicResult;
      
    } catch (error) {
      console.error(`❌ Error verifying email ${email}:`, error);
      return {
        email,
        isValid: false,
        deliverability: 'unknown',
        confidence: 0,
        reason: 'Verification service error',
        details: {
          syntaxValid: true,
          domainExists: false,
          mxRecordExists: false,
          smtpValid: false,
          disposable: false,
          role: false,
          spamTrap: false,
          toxic: false,
        },
        riskScore: 80
      };
    }
  }

  /**
   * Bulk verify multiple email addresses
   */
  async verifyBulkEmails(emails: string[]): Promise<EmailVerificationResult[]> {
    try {
      console.log(`🔍 Bulk verifying ${emails.length} emails`);
      
      // Process in batches to avoid overwhelming the service
      const batchSize = 50;
      const results: EmailVerificationResult[] = [];
      
      for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);
        const batchPromises = batch.map(email => this.verifyEmail(email));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Small delay between batches
        if (i + batchSize < emails.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`✅ Bulk verification completed: ${results.filter(r => r.isValid).length}/${emails.length} valid`);
      return results;
      
    } catch (error) {
      console.error("❌ Error in bulk email verification:", error);
      throw error;
    }
  }

  /**
   * Get email quality score (0-100)
   */
  calculateEmailQualityScore(result: EmailVerificationResult): number {
    let score = 100;
    
    if (!result.isValid) return 0;
    
    // Deliverability impact
    switch (result.deliverability) {
      case 'deliverable': score -= 0; break;
      case 'risky': score -= 30; break;
      case 'undeliverable': score -= 100; break;
      case 'unknown': score -= 50; break;
    }
    
    // Risk factors
    if (result.details.spamTrap) score -= 50;
    if (result.details.toxic) score -= 40;
    if (result.details.disposable) score -= 25;
    if (result.details.role) score -= 15;
    if (!result.details.smtpValid) score -= 20;
    if (!result.details.mxRecordExists) score -= 30;
    
    // Provider bonus (well-known providers are generally better)
    const goodProviders = ['gmail', 'outlook', 'yahoo', 'icloud', 'aol'];
    if (result.provider && goodProviders.includes(result.provider.toLowerCase())) {
      score += 5;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get ZeroBounce credits (for compatibility with existing routes)
   */
  async getCredits(): Promise<{ success: boolean; credits?: number; error?: string }> {
    return await zerobounceService.getCredits();
  }

  /**
   * Generate email deliverability recommendations
   */
  generateDeliverabilityRecommendations(results: EmailVerificationResult[]): {
    overallScore: number;
    validCount: number;
    riskyCount: number;
    invalidCount: number;
    recommendations: string[];
    issues: Array<{
      type: string;
      count: number;
      impact: 'high' | 'medium' | 'low';
      recommendation: string;
    }>;
  } {
    const valid = results.filter(r => r.deliverability === 'deliverable');
    const risky = results.filter(r => r.deliverability === 'risky');
    const invalid = results.filter(r => r.deliverability === 'undeliverable');
    
    const overallScore = results.length > 0 
      ? Math.round(results.reduce((sum, r) => sum + this.calculateEmailQualityScore(r), 0) / results.length)
      : 0;

    const recommendations: string[] = [];
    const issues: any[] = [];

    // Analyze common issues
    const spamTraps = results.filter(r => r.details.spamTrap).length;
    const disposableEmails = results.filter(r => r.details.disposable).length;
    const roleEmails = results.filter(r => r.details.role).length;
    const syntaxErrors = results.filter(r => !r.details.syntaxValid).length;

    if (spamTraps > 0) {
      issues.push({
        type: 'spam_traps',
        count: spamTraps,
        impact: 'high' as const,
        recommendation: 'Remove spam trap emails immediately to protect sender reputation'
      });
      recommendations.push('Remove all identified spam trap emails from your list');
    }

    if (disposableEmails > results.length * 0.1) {
      issues.push({
        type: 'disposable_emails',
        count: disposableEmails,
        impact: 'medium' as const,
        recommendation: 'Consider removing disposable email addresses for better engagement'
      });
      recommendations.push('Filter out disposable email addresses for higher quality');
    }

    if (roleEmails > results.length * 0.2) {
      issues.push({
        type: 'role_emails',
        count: roleEmails,
        impact: 'medium' as const,
        recommendation: 'Role-based emails typically have lower engagement rates'
      });
      recommendations.push('Consider segmenting role-based emails separately');
    }

    if (syntaxErrors > 0) {
      issues.push({
        type: 'syntax_errors',
        count: syntaxErrors,
        impact: 'high' as const,
        recommendation: 'Fix syntax errors to prevent bounce issues'
      });
      recommendations.push('Clean up email addresses with syntax errors');
    }

    // Overall recommendations based on score
    if (overallScore < 70) {
      recommendations.push('Your email list needs significant cleaning before sending campaigns');
    } else if (overallScore < 85) {
      recommendations.push('Consider additional list cleaning to improve deliverability');
    } else {
      recommendations.push('Your email list quality is good - ready for campaigns');
    }

    return {
      overallScore,
      validCount: valid.length,
      riskyCount: risky.length,
      invalidCount: invalid.length,
      recommendations,
      issues
    };
  }

  /**
   * Validate email syntax
   */
  private validateEmailSyntax(email: string): { isValid: boolean; reason?: string } {
    // Basic regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(email)) {
      return { isValid: false, reason: 'Invalid email format' };
    }
    
    // Check for common syntax issues
    if (email.length > 254) {
      return { isValid: false, reason: 'Email address too long' };
    }
    
    const [localPart, domain] = email.split('@');
    
    if (localPart.length > 64) {
      return { isValid: false, reason: 'Local part too long' };
    }
    
    if (domain.length > 253) {
      return { isValid: false, reason: 'Domain too long' };
    }
    
    // Check for consecutive dots
    if (email.includes('..')) {
      return { isValid: false, reason: 'Consecutive dots not allowed' };
    }
    
    // Check for invalid characters
    const invalidChars = /[<>()[\]\\,;:\s@"]/g;
    if (invalidChars.test(localPart.replace(/"/g, ''))) {
      return { isValid: false, reason: 'Invalid characters in email' };
    }
    
    return { isValid: true };
  }

  /**
   * Perform basic email verification without external services
   */
  private async performBasicVerification(email: string): Promise<EmailVerificationResult> {
    const [localPart, domain] = email.split('@');
    
    // Check for common disposable email providers
    const disposableProviders = [
      '10minutemail.com', 'tempmail.org', 'guerrillamail.com', 'mailinator.com',
      'yopmail.com', 'temp-mail.org', 'throwaway.email'
    ];
    
    const isDisposable = disposableProviders.some(provider => 
      domain.toLowerCase().includes(provider)
    );
    
    // Check for role-based emails
    const roleKeywords = ['admin', 'info', 'support', 'sales', 'marketing', 'noreply', 'no-reply'];
    const isRole = roleKeywords.some(keyword => 
      localPart.toLowerCase().includes(keyword)
    );
    
    // Determine provider
    const provider = this.getEmailProvider(domain);
    
    // Basic risk assessment
    let riskScore = 20; // Base risk
    if (isDisposable) riskScore += 40;
    if (isRole) riskScore += 15;
    if (!provider) riskScore += 25; // Unknown provider
    
    const deliverability = riskScore > 60 ? 'risky' : 'deliverable';
    
    return {
      email,
      isValid: true,
      deliverability,
      confidence: Math.max(40, 100 - riskScore),
      details: {
        syntaxValid: true,
        domainExists: true, // Assume true for basic verification
        mxRecordExists: true, // Assume true for basic verification
        smtpValid: false, // Cannot verify without SMTP check
        disposable: isDisposable,
        role: isRole,
        spamTrap: false, // Cannot detect without service
        toxic: false,
      },
      provider,
      riskScore
    };
  }

  /**
   * Map ZeroBounce result to our format
   */
  private mapZeroBounceResult(email: string, zbResult: any): EmailVerificationResult {
    const deliverabilityMap: Record<string, 'deliverable' | 'undeliverable' | 'risky' | 'unknown'> = {
      'valid': 'deliverable',
      'invalid': 'undeliverable',
      'catch-all': 'risky',
      'unknown': 'unknown',
      'spamtrap': 'undeliverable',
      'abuse': 'undeliverable',
      'do_not_mail': 'undeliverable'
    };
    
    return {
      email,
      isValid: zbResult.status === 'valid',
      deliverability: deliverabilityMap[zbResult.status] || 'unknown',
      confidence: Math.max(0, Math.min(100, 100 - (zbResult.sub_status === 'possible_typo' ? 30 : 0))),
      reason: zbResult.sub_status,
      details: {
        syntaxValid: zbResult.status !== 'invalid',
        domainExists: zbResult.mx_found === 'true',
        mxRecordExists: zbResult.mx_found === 'true',
        smtpValid: zbResult.smtp_provider !== null,
        disposable: zbResult.disposable === 'true',
        role: zbResult.role === 'true',
        spamTrap: zbResult.status === 'spamtrap',
        toxic: zbResult.toxic === 'true',
      },
      provider: this.getEmailProvider(email.split('@')[1]),
      riskScore: this.calculateRiskScore(zbResult)
    };
  }

  /**
   * Get email provider from domain
   */
  private getEmailProvider(domain: string): string | undefined {
    const providerMap: Record<string, string> = {
      'gmail.com': 'gmail',
      'googlemail.com': 'gmail',
      'outlook.com': 'outlook',
      'hotmail.com': 'outlook',
      'live.com': 'outlook',
      'msn.com': 'outlook',
      'yahoo.com': 'yahoo',
      'yahoo.co.uk': 'yahoo',
      'ymail.com': 'yahoo',
      'icloud.com': 'icloud',
      'me.com': 'icloud',
      'mac.com': 'icloud',
      'aol.com': 'aol',
    };
    
    return providerMap[domain.toLowerCase()];
  }

  /**
   * Calculate risk score from ZeroBounce result
   */
  private calculateRiskScore(zbResult: any): number {
    let risk = 0;
    
    if (zbResult.status === 'invalid') risk += 100;
    else if (zbResult.status === 'spamtrap') risk += 100;
    else if (zbResult.status === 'abuse') risk += 90;
    else if (zbResult.status === 'do_not_mail') risk += 80;
    else if (zbResult.status === 'catch-all') risk += 40;
    else if (zbResult.status === 'unknown') risk += 60;
    
    if (zbResult.disposable === 'true') risk += 30;
    if (zbResult.toxic === 'true') risk += 40;
    if (zbResult.role === 'true') risk += 15;
    if (zbResult.mx_found === 'false') risk += 50;
    
    return Math.min(100, risk);
  }
}

export const emailVerificationService = new EmailVerificationService();