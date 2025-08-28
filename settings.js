// settings.js
import React, {
  useEffect,
  useState,
  useCallback,
  useContext,
  useRef,
  useLayoutEffect,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
  Linking,
  ScrollView,
  ActivityIndicator,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "./supabase";
import DefaultProfileImage from "./assets/profile.png";
import { LanguageContext } from "./language";
import { MaterialIcons } from "@expo/vector-icons";
import Logo1 from "./assets/logo1.png";
import {
  setNotificationsEnabled,
  setSoundEnabled,
  setVibrationEnabled,
} from "./appPrefs";

const TOGGLE_KEYS = {
  notifications: "settings:notifications",
  sound: "settings:sound",
  vibration: "settings:vibration",
  // NEW demo toggles
  mockLocation: "settings:mock-location",
  mockDisaster: "settings:mock-disaster",
};
const CONTACTS_KEY = "settings:close-contacts";
const MAX_CONTACTS = 5;

// helper: ISO code => flag emoji
const countryCodeToFlagEmoji = (code = "") =>
  code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt()));

export default function Settings() {
  const navigation = useNavigation();
  const { lang, setLang } = useContext(LanguageContext);
  const insets = useSafeAreaInsets();
  useLayoutEffect(() => {
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  // Auth/session + profile
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  // Toggles
  const [notifications, setNotifications] = useState(false);
  const [sound, setSound] = useState(true);
  const [vibration, setVibration] = useState(true);
  // NEW: demo toggles
  const [mockLocation, setMockLocation] = useState(false);
  const [mockDisaster, setMockDisaster] = useState(false);

  // UI state
  const [showLang, setShowLang] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  // Edit profile modal
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Contacts
  const [contacts, setContacts] = useState([]);
  const [showContacts, setShowContacts] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [cName, setCName] = useState("");
  const [cRelation, setCRelation] = useState("");
  const [cPhone, setCPhone] = useState("");

  // Region
  const [region, setRegion] = useState("");
  const [loadingRegion, setLoadingRegion] = useState(false);
  const spinAnim = useRef(new Animated.Value(0)).current;

  /* ---------- Load session & profile ---------- */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const sess = data?.session ?? null;
      setSession(sess);
      if (sess?.user?.id) {
        const { data: p } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", sess.user.id)
          .single();

        const prof = p || {
          id: sess.user.id,
          name: "",
          username: "",
          avatar_url: "",
          region: "",
        };
        setProfile(prof);
        setAvatarUrl(prof.avatar_url || "");
        setRegion(prof.region || "");
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) {
        setProfile(null);
        setAvatarUrl("");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /* ---------- Load toggles ---------- */
  useEffect(() => {
    (async () => {
      try {
        const [n, s, v, ml, md] = await Promise.all([
          AsyncStorage.getItem(TOGGLE_KEYS.notifications),
          AsyncStorage.getItem(TOGGLE_KEYS.sound),
          AsyncStorage.getItem(TOGGLE_KEYS.vibration),
          AsyncStorage.getItem(TOGGLE_KEYS.mockLocation),
          AsyncStorage.getItem(TOGGLE_KEYS.mockDisaster),
        ]);
        if (n !== null) setNotifications(n === "1");
        if (s !== null) setSound(s === "1");
        if (v !== null) setVibration(v === "1");
        if (ml !== null) setMockLocation(ml === "1");
        if (md !== null) setMockDisaster(md === "1");
      } catch (err) {
        console.warn("Failed to load toggles", err);
      }
    })();
  }, []);

  const persistToggle = useCallback((key, value) => {
    AsyncStorage.setItem(key, value ? "1" : "0").catch(() => {});
  }, []);

  /* ---------- Load contacts ---------- */
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CONTACTS_KEY);
        setContacts(raw ? JSON.parse(raw) : []);
      } catch {
        setContacts([]);
      }
    })();
  }, []);
  const saveContacts = useCallback((arr) => {
    setContacts(arr);
    AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(arr)).catch(() => {});
  }, []);

  // Spin only when loadingRegion is true
  useEffect(() => {
    if (loadingRegion) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinAnim.stopAnimation(() => spinAnim.setValue(0));
    }
  }, [loadingRegion, spinAnim]);

  /* ---------- Derived profile display ---------- */
  const userDisplay = profile?.username || session?.user?.email || "Guest";
  const email = session?.user?.email || "";

  /* ---------- Actions ---------- */
  const onLogout = useCallback(() => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  }, []);

  const onChangePassword = useCallback(async () => {
    if (!newPassword) return;
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      Alert.alert("Success", "Password updated.");
      setShowPassword(false);
      setNewPassword("");
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to update password");
    }
  }, [newPassword]);

  const pickAndUploadAvatar = useCallback(async () => {
    if (!session?.user) {
      return Alert.alert(
        "Not signed in",
        "Please log in to update your profile."
      );
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;

    const { uri } = result.assets[0];
    const ext = (uri.split(".").pop() || "jpg").toLowerCase();
    const fileName = `${uuidv4()}.${ext}`;
    const filePath = `${session.user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(
        filePath,
        { uri, name: fileName, type: `image/${ext}` },
        { contentType: `image/${ext}` }
      );

    if (uploadError) return Alert.alert("Upload failed", uploadError.message);

    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const publicUrl = data.publicUrl;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", session.user.id);

    if (updateError) return Alert.alert("Error", updateError.message);
    setAvatarUrl(publicUrl);
    setProfile((p) => (p ? { ...p, avatar_url: publicUrl } : p));
  }, [session?.user]);

  const openEditProfile = () => {
    setEditName(profile?.name || "");
    setEditUsername(profile?.username || "");
    setShowEditProfile(true);
  };

  const saveProfile = useCallback(async () => {
    if (!session?.user) return;
    if (editUsername && editUsername !== profile?.username) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", editUsername)
        .neq("id", session.user.id)
        .maybeSingle();
      if (existing) {
        return Alert.alert("Username taken", "Please choose another username.");
      }
    }

    const payload = {
      id: session.user.id,
      email: session.user.email,
      name: editName,
      username: editUsername,
      region,
    };
    const { error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" });
    if (error) return Alert.alert("Error", error.message);
    setProfile((p) => ({ ...(p || {}), ...payload, avatar_url: avatarUrl }));
    setShowEditProfile(false);
  }, [
    session?.user,
    editName,
    editUsername,
    avatarUrl,
    profile?.username,
    region,
  ]);

  /* ---------- Region detection ---------- */
  const detectRegion = useCallback(async () => {
    if (loadingRegion) return;
    setLoadingRegion(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "We need location permission to detect your region."
        );
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        maximumAge: 0,
      });

      const places = await Location.reverseGeocodeAsync(pos.coords);
      if (!places?.length) {
        Alert.alert("Oops", "Unable to determine your region.");
        return;
      }

      const { country = "Unknown", isoCountryCode = "" } = places[0];
      const value = `${country} ${countryCodeToFlagEmoji(
        isoCountryCode || ""
      )}`;
      setRegion(value);

      if (session?.user?.id) {
        const { error } = await supabase
          .from("profiles")
          .update({ region: value })
          .eq("id", session.user.id);
        if (error) throw error;
        setProfile((p) => (p ? { ...p, region: value } : p));
      }
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to detect region");
    } finally {
      setLoadingRegion(false);
    }
  }, [loadingRegion, session?.user?.id]);

  // Contacts helpers omitted (unchanged)...
  const resetContactForm = () => {
    setEditingId(null);
    setCName("");
    setCRelation("");
    setCPhone("");
  };
  const openAddContact = () => {
    if (contacts.length >= MAX_CONTACTS) {
      return Alert.alert(
        "Limit reached",
        `You can save up to ${MAX_CONTACTS} close contacts.`
      );
    }
    resetContactForm();
    setShowContactForm(true);
  };
  const openEditContact = (c) => {
    setEditingId(c.id);
    setCName(c.name);
    setCRelation(c.relation || "");
    setCPhone(c.phone);
    setShowContactForm(true);
  };
  const deleteContact = (id) => {
    Alert.alert("Delete contact", "Remove this contact?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const next = contacts.filter((c) => c.id !== id);
          saveContacts(next);
        },
      },
    ]);
  };
  const saveContact = () => {
    if (!cName.trim() || !cPhone.trim()) {
      return Alert.alert("Missing info", "Name and phone are required.");
    }
    const item = {
      id: editingId || uuidv4(),
      name: cName.trim(),
      relation: cRelation.trim(),
      phone: cPhone.trim(),
    };
    let next;
    if (editingId) {
      next = contacts.map((c) => (c.id === editingId ? item : c));
    } else {
      next = [...contacts, item].slice(0, MAX_CONTACTS);
    }
    saveContacts(next);
    setShowContactForm(false);
  };
  const call = (phone) => Linking.openURL(`tel:${phone}`);

  /* ---------- RENDER ---------- */
  return (
    <LinearGradient colors={["#f8fafc", "#eef2ff"]} style={{ flex: 1 }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16 }}>
        <View style={styles.brandRow}>
          <Image source={Logo1} style={styles.brandLogo} />
          <Text style={styles.brandTitle}>Settings</Text>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: 0 }]}
        contentInsetAdjustmentBehavior="never"
      >
        {/* Profile header */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={openEditProfile}
          style={styles.headerCard}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Image
              source={avatarUrl ? { uri: avatarUrl } : DefaultProfileImage}
              style={styles.avatar}
            />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.name}>{userDisplay}</Text>
              {!!email && <Text style={styles.email}>{email}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={18} color="#111827" />
          </View>
        </TouchableOpacity>

        {/* Game Settings */}
        <SectionTitle>Game Settings</SectionTitle>
        <CardRow
          icon="notifications"
          label="Notifications"
          right={
            <Switch
              value={notifications}
              onValueChange={(v) => {
                setNotifications(v);
                setNotificationsEnabled(v);
              }}
            />
          }
        />
        <CardRow
          icon="volume-high"
          label="Sound"
          right={
            <Switch
              value={sound}
              onValueChange={(v) => {
                setSound(v);
                setSoundEnabled(v);
              }}
            />
          }
        />
        <CardRow
          icon="phone-portrait"
          label="Vibration"
          right={
            <Switch
              value={vibration}
              onValueChange={(v) => {
                setVibration(v);
                setVibrationEnabled(v);
              }}
            />
          }
        />

        {/* Language & Certificates */}
        <SectionTitle>Language & Certificates</SectionTitle>
        <CardRow
          icon="language"
          label={`Language: ${lang.toUpperCase()}`}
          onPress={() => setShowLang(true)}
          chevron
        />
        {/* Region (detect) */}
        <TouchableOpacity
          style={[styles.regionCard, loadingRegion && { opacity: 0.6 }]}
          onPress={loadingRegion ? undefined : detectRegion}
          activeOpacity={loadingRegion ? 1 : 0.8}
        >
          <View style={styles.regionInner}>
            <View style={styles.regionLeft}>
              <Ionicons name="earth" size={18} color="#111827" style={{ marginRight: 10 }} />
              <Text style={styles.rowText}>
                Region: <Text style={styles.regionValue}>{region || "Tap to detect"}</Text>
              </Text>
            </View>
            {loadingRegion ? (
              <ActivityIndicator size="small" />
            ) : (
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: spinAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0deg", "360deg"],
                      }),
                    },
                  ],
                }}
              >
                <MaterialIcons name="refresh" size={22} color="#6b7280" />
              </Animated.View>
            )}
          </View>
        </TouchableOpacity>
        <CardRow
          icon="document-text"
          label="Certificates"
          onPress={() => navigation.navigate("Certificates")}
          chevron
        />

        {/* NEW: Demo toggles */}
        <SectionTitle>Demo / Mock</SectionTitle>
        <CardRow
          icon="location"
          label="Use Mock Location (Taman Jurong)"
          right={
            <Switch
              value={mockLocation}
              onValueChange={(v) => {
                setMockLocation(v);
                persistToggle(TOGGLE_KEYS.mockLocation, v);
              }}
            />
          }
        />
        <CardRow
          icon="warning"
          label="Mock Disaster (Taman Jurong)"
          right={
            <Switch
              value={mockDisaster}
              onValueChange={(v) => {
                setMockDisaster(v);
                persistToggle(TOGGLE_KEYS.mockDisaster, v);
              }}
            />
          }
        />

        {/* Contacts List */}
        <SectionTitle>Contacts List</SectionTitle>
        <CardRow
          icon="people"
          label="Emergency Contacts"
          onPress={() => setShowContacts(true)}
          chevron
        />

        {/* Account */}
        <SectionTitle>Account Settings</SectionTitle>
        <CardRow
          icon="key"
          label="Change Password"
          onPress={() => setShowPassword(true)}
          chevron
        />
        <CardRow icon="log-out" label="Logout" onPress={onLogout} chevron />
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Language modal */}
      <Modal visible={showLang} transparent animationType="fade" onRequestClose={() => setShowLang(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose Language</Text>
            <ModalButton
              text="English"
              onPress={() => {
                setLang("en");
                setShowLang(false);
              }}
            />
            <ModalButton
              text="中文"
              onPress={() => {
                setLang("zh");
                setShowLang(false);
              }}
            />
            <ModalButton text="Close" variant="secondary" onPress={() => setShowLang(false)} />
          </View>
        </View>
      </Modal>

      {/* Change password modal */}
      <Modal visible={showPassword} transparent animationType="fade" onRequestClose={() => setShowPassword(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed" size={18} color="#6b7280" style={{ marginRight: 6 }} />
              <TextInput
                placeholder="New password"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                style={{ flex: 1 }}
              />
            </View>
            <ModalButton text="Update" onPress={onChangePassword} />
            <ModalButton text="Cancel" variant="secondary" onPress={() => setShowPassword(false)} />
          </View>
        </View>
      </Modal>

      {/* Edit profile modal */}
      <Modal visible={showEditProfile} transparent animationType="fade" onRequestClose={() => setShowEditProfile(false)}>
        <View style={styles.backdrop}>
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>Edit Profile</Text>
            <View style={{ alignItems: "center", marginTop: 4, marginBottom: 16 }}>
              <Image
                source={avatarUrl ? { uri: avatarUrl } : DefaultProfileImage}
                style={styles.editAvatarLarge}
              />
              <TouchableOpacity onPress={pickAndUploadAvatar} style={styles.smallBtn}>
                <Text style={styles.smallBtnText}>Change Photo</Text>
              </TouchableOpacity>
            </View>

            {/* Name */}
            <View style={styles.pillInput}>
              <Ionicons name="person" size={18} color="#6b7280" style={styles.inputIcon} />
              <TextInput
                placeholder="Name"
                value={editName}
                onChangeText={setEditName}
                style={styles.pillField}
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Username */}
            <View style={styles.pillInput}>
              <Ionicons name="at" size={18} color="#6b7280" style={styles.inputIcon} />
              <TextInput
                placeholder="Username"
                autoCapitalize="none"
                value={editUsername}
                onChangeText={setEditUsername}
                style={styles.pillField}
                placeholderTextColor="#9ca3af"
              />
            </View>

            <TouchableOpacity onPress={saveProfile} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cancelCard}>
            <TouchableOpacity onPress={() => setShowEditProfile(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Contacts modal */}
      <Modal visible={showContacts} transparent animationType="fade" onRequestClose={() => setShowContacts(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.modalCard, { maxHeight: "80%" }]}>
            <Text style={styles.modalTitle}>Emergency Contacts</Text>

            {contacts.map((c) => (
              <View key={c.id} style={styles.contactRow}>
                <View style={styles.contactLeft}>
                  <View style={styles.emIcon}>
                    <Ionicons name="person" size={14} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "700" }}>
                      {c.name} {!!c.relation && <Text style={{ color: "#6b7280" }}>({c.relation})</Text>}
                    </Text>
                    <Text style={{ color: "#374151" }}>{c.phone}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => call(c.phone)}>
                    <Ionicons name="call" size={16} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.iconBtn, { backgroundColor: "#2563eb" }]}
                    onPress={() => openEditContact(c)}
                  >
                    <Ionicons name="create" size={16} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.iconBtn, { backgroundColor: "#ef4444" }]}
                    onPress={() => deleteContact(c.id)}
                  >
                    <Ionicons name="trash" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={[
                styles.modalBtn,
                { marginTop: 14, backgroundColor: contacts.length >= MAX_CONTACTS ? "#9ca3af" : "#22c55e" },
              ]}
              onPress={openAddContact}
              disabled={contacts.length >= MAX_CONTACTS}
            >
              <Text style={styles.modalBtnText}>
                Add Contact ({contacts.length}/{MAX_CONTACTS})
              </Text>
            </TouchableOpacity>

            <ModalButton text="Close" variant="secondary" onPress={() => setShowContacts(false)} />
          </View>
        </View>
      </Modal>

      {/* Add/Edit contact form */}
      <Modal
        visible={showContactForm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContactForm(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingId ? "Edit Contact" : "Add Contact"}</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person" size={18} color="#6b7280" style={{ marginRight: 6 }} />
              <TextInput placeholder="Full name" value={cName} onChangeText={setCName} style={{ flex: 1 }} />
            </View>
            <View style={[styles.inputWrap, { marginTop: 10 }]}>
              <Ionicons name="heart" size={18} color="#6b7280" style={{ marginRight: 6 }} />
              <TextInput
                placeholder="Relation (e.g. Spouse)"
                value={cRelation}
                onChangeText={setCRelation}
                style={{ flex: 1 }}
              />
            </View>
            <View style={[styles.inputWrap, { marginTop: 10 }]}>
              <Ionicons name="call" size={18} color="#6b7280" style={{ marginRight: 6 }} />
              <TextInput
                placeholder="Phone number"
                keyboardType="phone-pad"
                value={cPhone}
                onChangeText={setCPhone}
                style={{ flex: 1 }}
              />
            </View>
            <ModalButton text={editingId ? "Save" : "Add"} onPress={saveContact} />
            <ModalButton text="Cancel" variant="secondary" onPress={() => setShowContactForm(false)} />
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

/* ---------- small UI helpers ---------- */
function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}
function CardRow({ icon, label, right, onPress, chevron }) {
  const content = (
    <View style={styles.rowInner}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={18} color="#111827" style={{ marginRight: 10 }} />
        <Text style={styles.rowText}>{label}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {right}
        {chevron && <Ionicons name="chevron-forward" size={18} color="#111827" />}
      </View>
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.row}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={styles.row}>{content}</View>;
}
function ModalButton({ text, onPress, variant = "primary" }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.modalBtn, variant === "secondary" && { backgroundColor: "#e5e7eb" }]}
    >
      <Text style={[styles.modalBtnText, variant === "secondary" && { color: "#111827" }]}>{text}</Text>
    </TouchableOpacity>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  brandLogo: {
    width: 30,
    height: 30,
    borderRadius: 6,
    resizeMode: "contain",
    backgroundColor: "#EEF2FF",
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: 0.2,
  },
  container: { padding: 16 },
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 16,
  },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#eee" },
  name: { fontWeight: "800", fontSize: 16, color: "#111827" },
  email: { color: "#6b7280", marginTop: 2 },

  sectionTitle: {
    marginTop: 8,
    marginBottom: 6,
    fontWeight: "800",
    color: "#111827",
    fontSize: 16,
  },

  row: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
    marginBottom: 10,
    height: 56,
    justifyContent: "center",
  },
  rowInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLeft: { flexDirection: "row", alignItems: "center" },
  rowText: { color: "#111827", fontWeight: "600", fontSize: 15 },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
  },
  modalTitle: { fontWeight: "800", fontSize: 16, marginBottom: 10, color: "#111827" },
  modalBtn: {
    backgroundColor: "#6366F1",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  modalBtnText: { color: "#fff", fontWeight: "700" },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 44,
    backgroundColor: "#fff",
  },

  // contacts
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },
  contactLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  emIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtn: {
    backgroundColor: "#10b981",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },

  // Edit Profile card
  editCard: {
    width: "92%",
    maxWidth: 520,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  editTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  editAvatarLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#eef2ff",
    marginTop: 8,
  },
  smallBtn: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#EEF2FF",
  },
  smallBtnText: { color: "#374151", fontWeight: "700" },

  // Inputs
  pillInput: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "#F5F7FB",
    borderWidth: 1,
    borderColor: "#E6E9F2",
    height: 52,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  inputIcon: { marginRight: 8 },
  pillField: { flex: 1, fontSize: 16, color: "#111827" },

  // Primary Save
  primaryBtn: {
    marginTop: 16,
    backgroundColor: "#6366F1",
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },

  // Cancel sheet
  cancelCard: {
    width: "92%",
    maxWidth: 520,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cancelBtn: { height: 56, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { fontSize: 16, fontWeight: "700", color: "#111827" },

  // Detect region button
  regionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  regionInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  regionLeft: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  regionValue: { color: "#111827", fontWeight: "700" },
});
