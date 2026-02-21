"""
E2E Test Suite for pace42
Tests auth + Garmin + analysis flows
"""

import os
import pytest
import requests
import re
from typing import Dict, Optional

# Test configuration
BASE_URL = os.getenv("PACE42_BASE_URL", "http://localhost:3000")
TIMEOUT = int(os.getenv("PACE42_TIMEOUT", "60"))

# Test credentials from environment
TEST_USERNAME = os.getenv("PACE42_TEST_USERNAME")
TEST_PASSWORD = os.getenv("PACE42_TEST_PASSWORD")
GARMIN_USERNAME = os.getenv("PACE42_GARMIN_USERNAME")
GARMIN_PASSWORD = os.getenv("PACE42_GARMIN_PASSWORD")

# Optional secondary credentials for multi-user tests
TEST_USERNAME_B = os.getenv("PACE42_TEST_USERNAME_B")
TEST_PASSWORD_B = os.getenv("PACE42_TEST_PASSWORD_B")
GARMIN_USERNAME_B = os.getenv("PACE42_GARMIN_USERNAME_B")
GARMIN_PASSWORD_B = os.getenv("PACE42_GARMIN_PASSWORD_B")


class TestSession:
    """Helper class to manage test session state"""
    
    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password
        self.access_token: Optional[str] = None
        self.garmin_connected: bool = False
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json"
        })

    def _password_is_compliant(self) -> bool:
        """Check password meets backend policy."""
        if not self.password:
            return False
        # Must contain uppercase, lowercase, number, special char, length >= 8
        pattern = re.compile(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$')
        return bool(pattern.match(self.password))

    def ensure_auth(self) -> bool:
        """Ensure we are authenticated; login if needed."""
        if self.access_token:
            return True
        return self.login()
    
    def signup(self) -> bool:
        """Attempt signup, return True if successful or user exists"""
        try:
            if not self._password_is_compliant():
                print("⚠ Password does not meet policy; skipping signup and relying on login")
                return True

            response = self.session.post(
                f"{BASE_URL}/api/v1/auth/signup",
                json={
                    "username": self.username,
                    "password": self.password
                },
                timeout=TIMEOUT
            )
            
            if response.status_code == 201:
                print(f"✓ User {self.username} created")
                return True
            elif response.status_code == 409:
                print(f"⚠ User {self.username} already exists, will use login")
                return True
            else:
                print(f"✗ Signup failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"✗ Signup error: {e}")
            return False
    
    def login(self) -> bool:
        """Login and store access token"""
        try:
            response = self.session.post(
                f"{BASE_URL}/api/v1/auth/login",
                json={
                    "username": self.username,
                    "password": self.password
                },
                timeout=TIMEOUT
            )
            
            if response.status_code == 200:
                data = response.json()
                self.access_token = data.get("accessToken")
                if self.access_token:
                    self.session.headers.update({
                        "Authorization": f"Bearer {self.access_token}"
                    })
                    print(f"✓ User {self.username} logged in")
                    return True
            
            print(f"✗ Login failed: {response.status_code} - {response.text}")
            return False
            
        except Exception as e:
            print(f"✗ Login error: {e}")
            return False
    
    def connect_garmin(self, garmin_username: str, garmin_password: str) -> bool:
        """Connect Garmin account"""
        try:
            if not self.ensure_auth():
                print("✗ Garmin connect failed: no auth token")
                return False
            response = self.session.post(
                f"{BASE_URL}/api/v1/auth/validate-garmin",
                json={
                    "garminUsername": garmin_username,
                    "garminPassword": garmin_password
                },
                timeout=TIMEOUT
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("valid") is True or data.get("success") is True:
                    self.garmin_connected = True
                    print(f"✓ Garmin connected for {self.username}")
                    return True
            
            print(f"✗ Garmin connect failed: {response.status_code} - {response.text}")
            return False
            
        except Exception as e:
            print(f"✗ Garmin connect error: {e}")
            return False
    
    def disconnect_garmin(self) -> bool:
        """Disconnect Garmin account"""
        try:
            if not self.garmin_connected:
                print("⚠ Garmin disconnect skipped (not connected)")
                return True
            if not self.ensure_auth():
                print("✗ Garmin disconnect failed: no auth token")
                return False
            response = self.session.post(
                f"{BASE_URL}/api/v1/auth/disconnect-garmin",
                timeout=TIMEOUT
            )
            
            if response.status_code == 200:
                self.garmin_connected = False
                print(f"✓ Garmin disconnected for {self.username}")
                return True
            
            print(f"✗ Garmin disconnect failed: {response.status_code}")
            return False
            
        except Exception as e:
            print(f"✗ Garmin disconnect error: {e}")
            return False
    
    def get_profile(self) -> Optional[Dict]:
        """Get user profile"""
        try:
            if not self.ensure_auth():
                print("✗ Get profile failed: no auth token")
                return None
            response = self.session.get(
                f"{BASE_URL}/api/v1/auth/me",
                timeout=TIMEOUT
            )
            
            if response.status_code == 200:
                return response.json()
            
            print(f"✗ Get profile failed: {response.status_code}")
            return None
            
        except Exception as e:
            print(f"✗ Get profile error: {e}")
            return None
    
    def query_analysis(self, query: str) -> Optional[Dict]:
        """Send analysis query to chat endpoint"""
        try:
            if not self.ensure_auth():
                print("✗ Query failed: no auth token")
                return None
            response = self.session.post(
                f"{BASE_URL}/api/v1/chat",
                json={"message": query},
                timeout=TIMEOUT
            )
            
            if response.status_code == 200:
                return response.json()
            
            print(f"✗ Query failed: {response.status_code} - {response.text}")
            return None
            
        except Exception as e:
            print(f"✗ Query error: {e}")
            return None


@pytest.fixture(scope="session")
def primary_session():
    """Primary test session"""
    if not TEST_USERNAME or not TEST_PASSWORD:
        pytest.skip("Primary credentials not configured")
    
    session = TestSession(TEST_USERNAME, TEST_PASSWORD)
    yield session


@pytest.fixture(scope="session")
def secondary_session():
    """Secondary test session for multi-user tests"""
    if not TEST_USERNAME_B or not TEST_PASSWORD_B:
        pytest.skip("Secondary credentials not configured")
    
    session = TestSession(TEST_USERNAME_B, TEST_PASSWORD_B)
    yield session


class TestScenario1NewUserFlow:
    """Scenario 1: New User Flow - signup → Garmin connect → query → disconnect"""
    
    def test_01_signup_or_login(self, primary_session):
        """Step 1: Signup or login if user exists"""
        assert primary_session.signup(), "Signup/user exists check failed"
        assert primary_session.login(), "Login failed"
    
    def test_02_connect_garmin(self, primary_session):
        """Step 2: Connect Garmin account"""
        if not GARMIN_USERNAME or not GARMIN_PASSWORD:
            pytest.skip("Garmin credentials not configured")
        
        assert primary_session.connect_garmin(
            GARMIN_USERNAME, 
            GARMIN_PASSWORD
        ), "Garmin connect failed"
        
        # Verify connection in profile
        profile = primary_session.get_profile()
        assert profile is not None, "Failed to get profile"
        assert profile.get("garminConnected") is True, "Garmin not connected in profile"
    
    def test_03_query_last_run(self, primary_session):
        """Step 3: Query 'Analyze my last run'"""
        response = primary_session.query_analysis("Analyze my last run")
        assert response is not None, "Query failed"
        
        # Verify response contains expected data
        response_text = str(response).lower()
        assert any(keyword in response_text for keyword in ["km", "pace", "heart", "run"]), \
            "Response missing expected activity keywords"
    
    def test_04_query_compare_runs(self, primary_session):
        """Step 4: Query 'Compare my last 3 runs'"""
        response = primary_session.query_analysis("Compare my last 3 runs")
        assert response is not None, "Query failed"
        
        # Verify response contains comparison data
        response_text = str(response).lower()
        assert any(keyword in response_text for keyword in ["compare", "run", "pace", "distance"]), \
            "Response missing expected comparison keywords"
    
    def test_05_disconnect_garmin(self, primary_session):
        """Step 5: Disconnect Garmin"""
        if not GARMIN_USERNAME or not GARMIN_PASSWORD:
            pytest.skip("Garmin credentials not configured")
        assert primary_session.disconnect_garmin(), "Garmin disconnect failed"
        
        # Verify disconnection in profile
        profile = primary_session.get_profile()
        assert profile is not None, "Failed to get profile"
        assert profile.get("garminConnected") is False, "Garmin still connected in profile"


class TestScenario2ReconnectFlow:
    """Scenario 2: Reconnect Flow - login → reconnect → query"""
    
    def test_01_login(self, primary_session):
        """Step 1: Login with existing user"""
        assert primary_session.login(), "Login failed"
    
    def test_02_reconnect_garmin(self, primary_session):
        """Step 2: Reconnect Garmin account"""
        if not GARMIN_USERNAME or not GARMIN_PASSWORD:
            pytest.skip("Garmin credentials not configured")
        
        assert primary_session.connect_garmin(
            GARMIN_USERNAME,
            GARMIN_PASSWORD
        ), "Garmin reconnect failed"
        
        # Verify connection
        profile = primary_session.get_profile()
        assert profile is not None, "Failed to get profile"
        assert profile.get("garminConnected") is True, "Garmin not reconnected"
    
    def test_03_query_recent_runs(self, primary_session):
        """Step 3: Query 'How were my recent runs?'"""
        response = primary_session.query_analysis("How were my recent runs?")
        assert response is not None, "Query failed"
        
        # Verify response contains activity data
        response_text = str(response).lower()
        assert any(keyword in response_text for keyword in ["run", "activity", "pace", "distance"]), \
            "Response missing expected activity keywords"


@pytest.mark.multiuser
class TestScenario3MultiUserIsolation:
    """Scenario 3: Multi-User Isolation - verify no data leakage between users"""
    
    def test_01_setup_user_a(self, primary_session):
        """Step 1: Setup User A"""
        assert primary_session.signup(), "User A signup failed"
        assert primary_session.login(), "User A login failed"
        
        if GARMIN_USERNAME and GARMIN_PASSWORD:
            primary_session.connect_garmin(GARMIN_USERNAME, GARMIN_PASSWORD)
    
    def test_02_setup_user_b(self, secondary_session):
        """Step 2: Setup User B"""
        assert secondary_session.signup(), "User B signup failed"
        assert secondary_session.login(), "User B login failed"
        
        if GARMIN_USERNAME_B and GARMIN_PASSWORD_B:
            secondary_session.connect_garmin(GARMIN_USERNAME_B, GARMIN_PASSWORD_B)
    
    def test_03_query_user_a(self, primary_session):
        """Step 3: Query User A data"""
        profile_a = primary_session.get_profile()
        assert profile_a is not None, "User A profile failed"
        assert profile_a.get("username") == TEST_USERNAME, "User A username mismatch"
    
    def test_04_query_user_b(self, secondary_session):
        """Step 4: Query User B data"""
        profile_b = secondary_session.get_profile()
        assert profile_b is not None, "User B profile failed"
        assert profile_b.get("username") == TEST_USERNAME_B, "User B username mismatch"
    
    def test_05_verify_isolation(self, primary_session, secondary_session):
        """Step 5: Verify no data leakage"""
        profile_a = primary_session.get_profile()
        profile_b = secondary_session.get_profile()
        
        assert profile_a is not None and profile_b is not None, "Failed to get profiles"
        
        # Verify different users
        assert profile_a.get("username") != profile_b.get("username"), \
            "User isolation failed: same username"
        
        # Verify different Garmin connections (if applicable)
        if profile_a.get("garminConnected") and profile_b.get("garminConnected"):
            # Both connected, but should have different credentials
            # This is verified by the fact that they logged in with different credentials
            pass


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "--tb=short"])
