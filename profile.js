// // profile.js
// import React, { useState, useEffect, useCallback } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   Image,
//   TouchableOpacity,
//   Modal,
//   Pressable,
// } from 'react-native';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { useFocusEffect, useNavigation } from '@react-navigation/native';
// import { supabase } from './supabase';
// import { LinearGradient } from 'expo-linear-gradient';
// import { Ionicons } from '@expo/vector-icons';
// import DefaultProfileImage from './assets/profile.png';

// export default function Profile() {
//   const [profile, setProfile] = useState(null);
//   const [avatarUrl, setAvatarUrl] = useState('');
//   const [badge, setBadge] = useState('Loading...');
//   const [score, setScore] = useState('Loading...');
//   const [session, setSession] = useState(null);
//   const [isAvatarModalVisible, setAvatarModalVisible] = useState(false);
//   const navigation = useNavigation();

//   useFocusEffect(
//     useCallback(() => {
//       const fetchSession = async () => {
//         const { data } = await supabase.auth.getSession();
//         setSession(data.session);
//         if (data.session) fetchProfile(data.session.user.id);
//       };
//       fetchSession();

//       const loadQuizData = async () => {
//         const savedScore = await AsyncStorage.getItem('quiz_score');
//         const savedBadge = await AsyncStorage.getItem('quiz_badge');
//         setScore(savedScore || '0');
//         setBadge(savedBadge || '🚫 None');
//       };
//       loadQuizData();
//     }, [])
//   );

//   const fetchProfile = async (userId) => {
//     const { data, error } = await supabase
//       .from('profiles')
//       .select('*')
//       .eq('id', userId)
//       .single();

//     if (data) {
//       setProfile(data);
//       setAvatarUrl(data.avatar_url);
//     }
//   };

//   const handleLogout = async () => {
//     await supabase.auth.signOut();
//     navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
//   };

//   if (!profile) {
//     return (
//       <View style={styles.centered}><Text>Loading profile...</Text></View>
//     );
//   }

//   return (
//     <LinearGradient colors={['#EEF2FF', '#C7D2FE']} style={styles.container}>
//       <View style={styles.card}>
//         <View style={styles.header}>
//           <TouchableOpacity onPress={() => setAvatarModalVisible(true)}>
//             {avatarUrl ? (
//               <Image source={{ uri: avatarUrl }} style={styles.avatarImageLarge} />
//             ) : (
//               <Image source={DefaultProfileImage} style={styles.avatarImageLarge} />
//             )}
//           </TouchableOpacity>
//           <Text style={styles.profileName}>{profile.username || profile.email}</Text>
//           {profile.name && <Text style={styles.profileTitle}>{profile.name}</Text>}
//         </View>
//         <View style={styles.body}>
//           <Text style={styles.profileItem}>📧 {profile.email}</Text>
//           <Text style={styles.profileItem}>🏅 Last Badge: {badge}</Text>
//           <Text style={styles.profileItem}>📊 Last Score: {score}</Text>

//           <TouchableOpacity
//             style={styles.editButton}
//             onPress={() => navigation.navigate('EditProfile')}
//           >
//             <Text style={{ color: '#fff' }}>Edit Profile</Text>
//           </TouchableOpacity>

//           <TouchableOpacity
//             style={[styles.editButton, { backgroundColor: '#EF4444' }]}
//             onPress={handleLogout}
//           >
//             <Text style={{ color: '#fff' }}>Logout</Text>
//           </TouchableOpacity>
//         </View>
//       </View>

//       <Modal
//         visible={isAvatarModalVisible}
//         transparent={true}
//         animationType="fade"
//         onRequestClose={() => setAvatarModalVisible(false)}>
//         <Pressable
//           style={styles.modalBackdrop}
//           onPress={() => setAvatarModalVisible(false)}>
//           <View style={styles.modalContainer}>
//             {avatarUrl ? (
//               <Image source={{ uri: avatarUrl }} style={styles.enlargedAvatar} />
//             ) : (
//               <Image source={DefaultProfileImage} style={styles.enlargedAvatar} />
//             )}
//           </View>
//         </Pressable>
//       </Modal>
//     </LinearGradient>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     padding: 20,
//     width: '100%',
//   },
//   card: {
//     width: '100%',
//     borderRadius: 20,
//     backgroundColor: '#fff',
//     overflow: 'hidden',
//   },
//   header: {
//     alignItems: 'center',
//     padding: 30,
//     backgroundColor: '#6c63ff',
//     borderBottomLeftRadius: 20,
//     borderBottomRightRadius: 20,
//   },
//   avatarImageLarge: {
//     width: 100,
//     height: 100,
//     borderRadius: 50,
//     borderWidth: 2,
//     borderColor: '#fff',
//     backgroundColor: '#eee',
//     marginBottom: 10,
//   },
//   profileName: {
//     fontSize: 20,
//     fontWeight: '700',
//     color: '#fff',
//   },
//   profileTitle: {
//     fontSize: 14,
//     color: '#eee',
//     marginTop: 4,
//   },
//   body: {
//     padding: 20,
//   },
//   profileItem: {
//     fontSize: 14,
//     color: '#4B5563',
//     marginVertical: 4,
//   },
//   editButton: {
//     backgroundColor: '#6366F1',
//     paddingVertical: 12,
//     borderRadius: 50,
//     marginTop: 20,
//     alignItems: 'center',
//   },
//   modalBackdrop: {
//     flex: 1,
//     backgroundColor: 'rgba(0, 0, 0, 0.7)',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   modalContainer: {
//     width: 300,
//     height: 300,
//     backgroundColor: '#fff',
//     borderRadius: 10,
//     overflow: 'hidden',
//     padding: 10,
//   },
//   enlargedAvatar: {
//     width: '100%',
//     height: '100%',
//     resizeMode: 'contain',
//   },
//   centered: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
// });
