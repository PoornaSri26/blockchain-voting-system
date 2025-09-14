import React from 'react';
import {
  Box,
  Container,
  Typography,
  Link,
  Grid,
  IconButton,
} from '@mui/material';
import {
  GitHub,
  Security,
  Verified,
  Lock,
} from '@mui/icons-material';

const Footer: React.FC = () => {
  return (
    <Box
      component="footer"
      sx={{
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
        py: 3,
        mt: 'auto',
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <Typography variant="h6" gutterBottom>
              Blockchain Voting System
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Secure, transparent, and privacy-preserving digital elections
              powered by blockchain technology and zero-knowledge proofs.
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Typography variant="h6" gutterBottom>
              Security Features
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Security fontSize="small" color="primary" />
                <Typography variant="body2">Zero-Knowledge Privacy</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Verified fontSize="small" color="primary" />
                <Typography variant="body2">Verifiable Credentials</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Lock fontSize="small" color="primary" />
                <Typography variant="body2">Homomorphic Encryption</Typography>
              </Box>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Typography variant="h6" gutterBottom>
              Resources
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Link href="#" color="inherit" underline="hover">
                Documentation
              </Link>
              <Link href="#" color="inherit" underline="hover">
                Security Audit
              </Link>
              <Link href="#" color="inherit" underline="hover">
                Privacy Policy
              </Link>
              <Link href="#" color="inherit" underline="hover">
                Terms of Service
              </Link>
            </Box>
          </Grid>
        </Grid>
        
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mt: 3,
            pt: 3,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            © 2024 Blockchain Voting System. Built with enterprise-grade security.
          </Typography>
          
          <Box>
            <IconButton
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              color="inherit"
            >
              <GitHub />
            </IconButton>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
