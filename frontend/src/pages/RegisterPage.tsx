import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Link,
  CircularProgress,
  InputAdornment,
  IconButton,
  Grid,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Business,
  PersonAdd,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';

import { useAuthStore } from '../stores/authStore';
import { apiClient } from '../services/apiClient';

interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  first_name: string;
  last_name: string;
}

const RegisterPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { setUser, setToken } = useAuthStore();

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      first_name: '',
      last_name: '',
    },
  });

  const password = watch('password');

  const registerMutation = useMutation({
    mutationFn: async (data: Omit<RegisterFormData, 'confirmPassword'>) => {
      return apiClient.post('/auth/register', data);
    },
    onSuccess: async (user) => {
      // Auto-login after registration
      try {
        const loginResponse = await apiClient.post<{ access_token: string; token_type: string }>('/auth/login', {
          username: user.username,
          password: password,
        });
        
        setToken(loginResponse.access_token);
        setUser(user);
        navigate('/dashboard');
        enqueueSnackbar('Account created successfully!', { variant: 'success' });
      } catch (error) {
        enqueueSnackbar('Account created! Please log in.', { variant: 'success' });
        navigate('/login');
      }
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Registration failed';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    const { confirmPassword, ...registerData } = data;
    registerMutation.mutate(registerData);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 2,
      }}
    >
      <Card sx={{ maxWidth: 500, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Business sx={{ fontSize: 48, color: 'primary.main' }} />
          </Box>
          
          <Typography variant="h4" align="center" gutterBottom fontWeight="bold">
            Create Account
          </Typography>
          
          <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 4 }}>
            Join the AI Lead Generation Platform
          </Typography>

          <form onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="first_name"
                  control={control}
                  rules={{ required: 'First name is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="First Name"
                      variant="outlined"
                      error={!!errors.first_name}
                      helperText={errors.first_name?.message}
                      data-testid="input-first-name"
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="last_name"
                  control={control}
                  rules={{ required: 'Last name is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Last Name"
                      variant="outlined"
                      error={!!errors.last_name}
                      helperText={errors.last_name?.message}
                      data-testid="input-last-name"
                    />
                  )}
                />
              </Grid>
            </Grid>

            <Controller
              name="username"
              control={control}
              rules={{ 
                required: 'Username is required',
                minLength: { value: 3, message: 'Username must be at least 3 characters' }
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Username"
                  variant="outlined"
                  error={!!errors.username}
                  helperText={errors.username?.message}
                  sx={{ mt: 2 }}
                  data-testid="input-username"
                />
              )}
            />

            <Controller
              name="email"
              control={control}
              rules={{ 
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address'
                }
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Email"
                  type="email"
                  variant="outlined"
                  error={!!errors.email}
                  helperText={errors.email?.message}
                  sx={{ mt: 2 }}
                  data-testid="input-email"
                />
              )}
            />

            <Controller
              name="password"
              control={control}
              rules={{ 
                required: 'Password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' }
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  variant="outlined"
                  error={!!errors.password}
                  helperText={errors.password?.message}
                  sx={{ mt: 2 }}
                  data-testid="input-password"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            />

            <Controller
              name="confirmPassword"
              control={control}
              rules={{ 
                required: 'Please confirm your password',
                validate: (value) => value === password || 'Passwords do not match'
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Confirm Password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  variant="outlined"
                  error={!!errors.confirmPassword}
                  helperText={errors.confirmPassword?.message}
                  sx={{ mt: 2, mb: 3 }}
                  data-testid="input-confirm-password"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          edge="end"
                          data-testid="button-toggle-confirm-password"
                        >
                          {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={registerMutation.isPending}
              sx={{ mb: 2 }}
              data-testid="button-register"
              startIcon={
                registerMutation.isPending ? (
                  <CircularProgress size={20} />
                ) : (
                  <PersonAdd />
                )
              }
            >
              {registerMutation.isPending ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="body2">
              Already have an account?{' '}
              <Link
                component="button"
                onClick={() => navigate('/login')}
                data-testid="link-login"
              >
                Sign in here
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default RegisterPage;