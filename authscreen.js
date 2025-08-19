// authscreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from './supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import * as FileSystem from 'expo-file-system';
import DefaultProfileImage from './assets/profile.png';

function MainApp() {
  const [screen, setScreen] = useState('login');
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isAvatarModalVisible, setAvatarModalVisible] = useState(false);
  const [badge, setBadge] = useState('');
  const [score, setScore] = useState('');
  const resetMessagesAndPassword = () => {
    setNewPassword('');
    setError('');
    setSuccessMessage('');
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) {
        fetchProfile(data.session.user.id);
        setScreen('profile');
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session) {
          fetchProfile(session.user.id);
          // Only switch to profile if not already editing
          setScreen((prev) =>
            prev === 'edit-profile' ? 'edit-profile' : 'profile'
          );
        } else {
          setProfile(null);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, [fetchProfile]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchQuizData(session.user.id);
    }
  }, [session]);

  const fetchProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      setError(error.message);
      return;
    }

    // Initialize profile with default values if it doesn't exist
    const profileData = data || {
      id: userId,
      name: '',
      username: '',
      avatar_url: '', // We'll handle the default in the display
      email: session?.user?.email || '',
    };

    setProfile(profileData);
    setAvatarUrl(profileData.avatar_url); // Don't set default here, handle in display
  }, [session?.user?.email]); // Add dependencies here

  const fetchQuizData = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('quiz_score, quiz_badge')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setScore(data.quiz_score || '0');
      setBadge(data.quiz_badge || '🚫 None');
    } else {
      console.warn('⚠️ Failed to fetch quiz data:', error?.message);
      setScore('0');
      setBadge('🚫 None');
    }
  };

  const handleLogin = async () => {
    setError('');
    let loginEmail = emailOrUsername;
    if (!emailOrUsername.includes('@')) {
      const { data, error } = await supabase
        .from('profiles')
        .select('email')
        .eq('username', emailOrUsername)
        .single();
      if (error || !data) return setError('No account with that username.');
      loginEmail = data.email;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      console.log('Login successful!');
    }
  };

  const handleSignUp = async () => {
    setError('');
    if (password !== confirmPassword) return setError("Passwords don't match");
    const { error } = await supabase.auth.signUp({
      email: emailOrUsername,
      password,
      options: {
        emailRedirectTo:
          'https://supabase-reset-password-9j5m.vercel.app/confirm.html',
      },
    });
    if (error) setError(error.message);
    else setError('Check your inbox to confirm your email.');
  };

  const handleForgotPassword = async () => {
    setError('');
    if (!emailOrUsername.includes('@'))
      return setError('Enter your email to reset password.');
    const { error } = await supabase.auth.resetPasswordForEmail(
      emailOrUsername,
      {
        redirectTo:
          'https://supabase-reset-password-9j5m.vercel.app/reset.html',
      }
    );
    if (error) setError(error.message);
    else setError('Reset link sent to your inbox.');
  };

  const handleChangePassword = async () => {
    resetMessagesAndPassword();
    if (!newPassword) return setError('Please enter a new password.');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setError(error.message);
    else setSuccessMessage('Password updated successfully.');
  };

  const handleSaveProfile = async () => {
    resetMessagesAndPassword();
    if (!session?.user) return;

    const updatedName = name || profile?.name || '';
    const updatedUsername = username || profile?.username || '';

    const { error } = await supabase.from('profiles').upsert(
      {
        id: session.user.id,
        email: session.user.email,
        name: updatedName,
        username: updatedUsername,
      },
      {
        onConflict: 'id',
      }
    );

    if (error) {
      setError(error.message);
    } else {
      setSuccessMessage('Changes saved!');
      setTimeout(() => {
        setSuccessMessage('');
        fetchProfile(session.user.id);
      }, 2000);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          await AsyncStorage.clear();
          setScreen('login');
        },
      },
    ]);
  };

  const pickAndUploadImage = async () => {
    try {
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        return setError(fetchError.message);
      }

      if (!existingProfile) {
        const { error: insertError } = await supabase.from('profiles').insert([
          {
            id: session.user.id,
            email: session.user.email,
            name: profile?.name || '',
            username: profile?.username || '',
          },
        ]);
        if (insertError) {
          console.log('Insert error:', insertError);
          return setError('Could not create profile: ' + insertError.message);
        }
      }

      const { granted, status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!granted || status !== 'granted') {
        return setError('Permission to access media library is required!');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.length) {
        const { uri } = result.assets[0];
        const fileExt = uri.split('.').pop();
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `${session.user.id}/${fileName}`;

        // Read the file as a base64 string
        const fileContent = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Create a form data object to upload
        const formData = new FormData();
        formData.append('file', {
          uri,
          name: fileName,
          type: `image/${fileExt}`,
        });
  
        // Upload directly using the file URI
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(
            filePath,
            {
              uri,
              type: `image/${fileExt}`,
              name: fileName,
            },
            {
              contentType: `image/${fileExt}`,
            }
          );

        if (uploadError) return setError(uploadError.message);

        const { data } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
        const publicUrl = data.publicUrl;

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', session.user.id);

        if (updateError) setError(updateError.message);
        else {
          setAvatarUrl(publicUrl);
          fetchProfile(session.user.id);
        }
      }
    } catch (err) {
      console.error('Image picker error:', err);
      setError('Something went wrong while picking the image.');
    }
  };

  if (session && profile) {
    if (screen === 'edit-profile') {
      return (
        <SafeAreaView style={{ flex: 1 }}>
          <LinearGradient
            colors={['#EEF2FF', '#C7D2FE']}
            style={styles.containerTopAligned}>
            <TouchableOpacity
              onPress={() => setScreen('profile')}
              style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#6c63ff" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={pickAndUploadImage}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Image source={DefaultProfileImage} style={styles.avatarImage} />
              )}
            </TouchableOpacity>

            <Text style={styles.title}>Edit Profile</Text>

            <View style={styles.inputContainer}>
              <Ionicons
                name="person-outline"
                size={20}
                color="#888"
                style={styles.icon}
              />
              <TextInput
                placeholder="Your Name"
                style={styles.input}
                value={name || profile?.name || ''}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons
                name="person-circle-outline"
                size={20}
                color="#888"
                style={styles.icon}
              />
              <TextInput
                placeholder="Username"
                style={styles.input}
                value={username || profile?.username || ''}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#888"
                style={styles.icon}
              />
              <TextInput
                placeholder="Change Password"
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {successMessage ? (
              <Text style={styles.success}>{successMessage}</Text>
            ) : null}

            <TouchableOpacity
              style={styles.submitButton}
              onPress={async () => {
                resetMessagesAndPassword();

                if (username && username !== profile?.username) {
                  const { data } = await supabase
                    .from('profiles')
                    .select('username')
                    .eq('username', username)
                    .neq('id', session.user.id)
                    .single();

                  if (data) {
                    return setError(
                      'Username already taken. Please choose another.'
                    );
                  }
                }

                await handleSaveProfile();

                if (newPassword) {
                  await handleChangePassword();
                } else {
                  setSuccessMessage('Changes saved!');
                }
              }}>
              <Text style={styles.submitText}>Save Changes</Text>
            </TouchableOpacity>
          </LinearGradient>
        </SafeAreaView>
      );
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient colors={['#EEF2FF', '#C7D2FE']} style={styles.container}>
        {screen === 'login' && (
          <View style={styles.card}>
            <Text style={styles.title}>Login</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="person"
                size={20}
                color="#888"
                style={styles.icon}
              />
              <TextInput
                placeholder="Email or Username"
                placeholderTextColor="#666"
                style={styles.input}
                value={emailOrUsername}
                onChangeText={setEmailOrUsername}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed"
                size={20}
                color="#888"
                style={styles.icon}
              />
              <TextInput
                placeholder="Password"
                placeholderTextColor="#666"
                style={styles.input}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
            <TouchableOpacity onPress={() => setScreen('forgot')}>
              <Text style={styles.forgot}>Forgot Password?</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitButton} onPress={handleLogin}>
              <Ionicons name="arrow-forward" size={24} color="#fff" />
            </TouchableOpacity>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity onPress={() => setScreen('signup')}>
              <Text style={styles.switch}>New User? Create Account</Text>
            </TouchableOpacity>
          </View>
        )}

        {screen === 'signup' && (
          <View style={styles.card}>
            <Text style={styles.title}>Create Account</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="mail"
                size={20}
                color="#888"
                style={styles.icon}
              />
              <TextInput
                placeholder="Email"
                style={styles.input}
                value={emailOrUsername}
                onChangeText={setEmailOrUsername}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed"
                size={20}
                color="#888"
                style={styles.icon}
              />
              <TextInput
                placeholder="Password"
                style={styles.input}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed"
                size={20}
                color="#888"
                style={styles.icon}
              />
              <TextInput
                placeholder="Confirm Password"
                style={styles.input}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSignUp}>
              <Ionicons name="arrow-forward" size={24} color="#fff" />
            </TouchableOpacity>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity onPress={() => setScreen('login')}>
              <Text style={styles.switch}>Already a member? Login</Text>
            </TouchableOpacity>
          </View>
        )}

        {screen === 'forgot' && (
          <View style={styles.card}>
            <Text style={styles.title}>Reset Password</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="mail"
                size={20}
                color="#888"
                style={styles.icon}
              />
              <TextInput
                placeholder="Email"
                style={styles.input}
                value={emailOrUsername}
                onChangeText={setEmailOrUsername}
                autoCapitalize="none"
              />
            </View>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleForgotPassword}>
              <Ionicons name="arrow-forward" size={24} color="#fff" />
            </TouchableOpacity>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity onPress={() => setScreen('login')}>
              <Text style={styles.switch}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    width: '100%',
  },
  containerTopAligned: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 20,
    width: '100%',
  },
  card: {
    width: '100%',
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#fff',
    elevation: 4,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#ccc',
    marginBottom: 20,
    width: '100%',
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    height: 40,
    fontSize: 16,
    paddingHorizontal: 8,
  },
  icon: {
    marginRight: 10,
    width: 24,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 50,
    marginVertical: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  error: {
    color: 'red',
    textAlign: 'center',
    marginVertical: 10,
    paddingHorizontal: 20,
  },
  success: {
    color: 'green',
    textAlign: 'center',
    marginVertical: 10,
    paddingHorizontal: 20,
  },
  switch: {
    textAlign: 'center',
    marginTop: 10,
    color: '#6c63ff',
  },
  forgot: {
    textAlign: 'right',
    color: '#6c63ff',
    marginBottom: 10,
  },
  submitText: {
    color: '#fff',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  backText: {
    marginLeft: 6,
    fontSize: 16,
    color: '#6c63ff',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
});
