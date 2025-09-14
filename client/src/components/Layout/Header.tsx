import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Avatar,
} from '@mui/material';
import {
  AccountBalanceWallet,
  Person,
  Settings,
  ExitToApp,
  HowToVote,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useWeb3 } from '../../contexts/Web3Context';
import { useVoting } from '../../contexts/VotingContext';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { account, isConnected, connectWallet, disconnectWallet, chainId } = useWeb3();
  const { isRegistered } = useVoting();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleDisconnect = () => {
    disconnectWallet();
    handleMenuClose();
    navigate('/');
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getNetworkName = (chainId: number | null) => {
    switch (chainId) {
      case 1:
        return 'Mainnet';
      case 5:
        return 'Goerli';
      case 11155111:
        return 'Sepolia';
      default:
        return 'Unknown';
    }
  };

  return (
    <AppBar position="static" elevation={2}>
      <Toolbar>
        <HowToVote sx={{ mr: 2 }} />
        <Typography
          variant="h6"
          component="div"
          sx={{ flexGrow: 1, cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          Blockchain Voting System
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Navigation Links */}
          <Button color="inherit" onClick={() => navigate('/elections')}>
            Elections
          </Button>
          
          {isConnected && (
            <>
              <Button color="inherit" onClick={() => navigate('/identity')}>
                Identity
              </Button>
              <Button color="inherit" onClick={() => navigate('/register')}>
                Register
              </Button>
            </>
          )}

          {/* Network Indicator */}
          {isConnected && chainId && (
            <Chip
              label={getNetworkName(chainId)}
              size="small"
              color="secondary"
              variant="outlined"
            />
          )}

          {/* Wallet Connection */}
          {!isConnected ? (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<AccountBalanceWallet />}
              onClick={connectWallet}
            >
              Connect Wallet
            </Button>
          ) : (
            <>
              {/* Voter Status Indicator */}
              {isRegistered && (
                <Chip
                  label="Registered Voter"
                  size="small"
                  color="success"
                  variant="filled"
                />
              )}

              {/* Account Menu */}
              <IconButton
                size="large"
                edge="end"
                aria-label="account menu"
                aria-controls="account-menu"
                aria-haspopup="true"
                onClick={handleMenuOpen}
                color="inherit"
              >
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                  <Person />
                </Avatar>
              </IconButton>

              <Menu
                id="account-menu"
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                onClick={handleMenuClose}
                PaperProps={{
                  elevation: 0,
                  sx: {
                    overflow: 'visible',
                    filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                    mt: 1.5,
                    '& .MuiAvatar-root': {
                      width: 32,
                      height: 32,
                      ml: -0.5,
                      mr: 1,
                    },
                  },
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                <MenuItem disabled>
                  <Typography variant="body2" color="text.secondary">
                    {formatAddress(account!)}
                  </Typography>
                </MenuItem>
                
                <MenuItem onClick={() => navigate('/identity')}>
                  <Person fontSize="small" sx={{ mr: 1 }} />
                  Identity
                </MenuItem>
                
                <MenuItem onClick={() => navigate('/admin')}>
                  <Settings fontSize="small" sx={{ mr: 1 }} />
                  Admin
                </MenuItem>
                
                <MenuItem onClick={handleDisconnect}>
                  <ExitToApp fontSize="small" sx={{ mr: 1 }} />
                  Disconnect
                </MenuItem>
              </Menu>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
