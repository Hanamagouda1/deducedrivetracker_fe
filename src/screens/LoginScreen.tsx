import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Modal,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import GlassCard from '../styles/SharedGlassCard';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

type LoginScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Login'
>;

const { width } = Dimensions.get('window');

const LoginScreen = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'success' | 'error' | null>(null);
  const [modalMessage, setModalMessage] = useState('');
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleEmployeeIdChange = (text: string) => {
    setEmployeeId(text.toUpperCase());
  };

  const animatePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
    ]).start();
  };


const handleLogin = async () => {
    if (!employeeId || !password) {
      setModalType("error");
      setModalMessage("⚠️ All fields are required!");
      setModalVisible(true);
      return;
    }

    const empIdPattern = /^DT-\d{5}$/;
    if (!empIdPattern.test(employeeId)) {
      setModalType("error");
      setModalMessage("⚠️ Employee ID must be in the format DT-XXXXX");
      setModalVisible(true);
      return;
    }

    setLoading(true);
    animatePress();

    try {
      const res = await axios.post(
        "https://deduce-drive-tracker-be.onrender.com/auth/login",
        {
          employee_id: employeeId,
          password,
        }
      );

      // Save token
      await AsyncStorage.setItem("accessToken", res.data.access_token);
      await AsyncStorage.setItem("userInfo", JSON.stringify(res.data.user));

      setModalType("success");
      setModalMessage("✅ Login Successful!");
      setModalVisible(true);

      setTimeout(() => {
        setModalVisible(false);
        navigation.replace("Home");
      }, 1200);

    } 
    catch (error: any) {
      console.log("Login Error:", error);

      const status = error?.response?.status;
      const message = error?.response?.data?.detail;

      // 404 → Not registered
      if (status === 404) {
        setModalType("error");
        setModalMessage("❌ You are not registered. Please register first.");
      }

      // 401 → Wrong password
      else if (status === 401) {
        setModalType("error");
        setModalMessage("❌ Invalid Credentials");
      }

      // Other errors (network, server)
      else {
        setModalType("error");
        setModalMessage("❌ Unable to connect to the server. Try again.");
      }

      setModalVisible(true);
    }
    finally {
      setLoading(false);
    }
  };


  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor="#007AFF" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <GlassCard style={styles.card}>
          {/* Logo + Title */}
          <View style={{ width: "100%", alignItems: "center" }}>
          <View style={styles.titleContainer}>
            <Image
              source={require('../assets/CompanyLogo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
             <View style={styles.title}>
              <Text style={styles.titleBold}>DEDUCE</Text>
              <Text style={styles.titleSmall}>Drive Tracker</Text>
            </View>
            </View>
            <Text style={styles.subtitle}>Employee Login</Text>
          </View>

          {/* Employee ID Input */}
          <TextInput
            style={[
              styles.input,
              focusedInput === 'employeeId' && styles.inputFocused,
            ]}
            placeholder="Employee ID (DT-XXXXX)"
            placeholderTextColor="rgba(255,255,255,0.7)"
            value={employeeId}
            onChangeText={handleEmployeeIdChange}
            onFocus={() => setFocusedInput('employeeId')}
            onBlur={() => setFocusedInput(null)}
            autoCapitalize="characters"
            maxLength={8}
          />

          {/* Password Input */}
        <View style={{ width: width * 0.75, marginBottom: 18 }}>
          <TextInput
            style={[
              styles.input,
              focusedInput === "password" && styles.inputFocused,
              { paddingRight: 45 }, 
            ]}
            placeholder="Password"
            placeholderTextColor="rgba(255,255,255,0.7)"
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocusedInput("password")}
            onBlur={() => setFocusedInput(null)}
            secureTextEntry={!showPassword}
          />

          <TouchableOpacity
            onPress={() => setShowPassword((prev) => !prev)}
            style={{
              position: "absolute",
              right: 12,
              top: 12,
              padding: 4,
            }}
          >
            <Image
              source={{
                uri: showPassword
                  ? "https://img.icons8.com/ios-filled/50/visible.png"
                  : "https://img.icons8.com/ios-filled/50/closed-eye.png",
              }}
              style={{ width: 22, height: 22, tintColor: "white" }}
            />
          </TouchableOpacity>
        </View>


          {/* Login Button */}
          <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '100%' }}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.button, loading && { opacity: 0.8 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Bottom Links */}
          <View style={styles.bottomLinks}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.replace('ForgotPassword')}
            >
              <Text style={styles.linkText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.replace('Register')}
            >
              <Text style={styles.linkText}>New User? Register</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
      </ScrollView>

      {/* Success/Error Modal */}
      <Modal transparent visible={modalVisible} animationType="fade">
      <View style={styles.modalContainer}>
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: '#ffffff',
              borderColor: modalType === 'success' ? '#28a745' : '#ff4d4d',
              borderWidth: 1.5,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 1,
              shadowRadius: 5,
              elevation: 6,
            },
          ]}
        >
          <Text
            style={[
              styles.modalText,
              {
                color: modalType === 'success' ? '#28a745' : '#ff4d4d',
                fontWeight: '600',
              },
            ]}
          >
            {modalMessage}
          </Text>

          {modalType === 'error' && (
            <TouchableOpacity
              style={[
                styles.modalButton,
                { backgroundColor: modalType === 'error' ? '#ff4d4d' : '#28a745' },
              ]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
  },

  card: {
    width: width * 0.9,
    alignItems: 'center',
    justifyContent: 'center',  
    paddingVertical: 25,
    minHeight: 350,             
  }, 

  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",  
    paddingHorizontal: 10,
  },

  logo: {
    width: 60,
    height: 60,
    marginRight: 10,           
  },

  title: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",       
    maxWidth: width * 0.55,
  },

  titleBold: {
    fontSize: 30,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",        
  },

  titleSmall: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",        
    marginTop: -4,
    opacity: 0.9,
  },

  subtitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 10,
    textAlign: 'center',
    opacity: 0.9,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },

  input: {
    width: width * 0.75,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 15,
    paddingHorizontal: 15,
    marginBottom: 18,
    fontSize: 16,
    color: 'black',
  },

  inputFocused: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderColor: '#4688b4ff',
    borderWidth: 1,
    shadowColor: '#56a8dfff',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },

  button: {
    width: width * 0.75,
    height: 50,
    backgroundColor: '#28a745',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },

  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },

  bottomLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: width * 0.75,
  },

  linkText: {
    color: 'black',
    fontSize: 14,
    textDecorationLine: 'underline',
    opacity: 1,
  },

  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },

  modalContent: {
    width: '80%',
    padding: 25,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1.5,
  },

  modalText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 15,
  },

  modalButton: {
    width: '50%',
    padding: 10,
    height: 45,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default LoginScreen;
