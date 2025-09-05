// containers/SettingsContainer.js
import React, {
  useEffect,
  useState,
  useCallback,
  useContext,
  useRef,
  useLayoutEffect,
} from "react";
import { Alert, Animated, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";

// paths
import { supabase } from "../supabase";
import DefaultProfileImage from "../assets/profile.png";
import Logo1 from "../assets/logo1.png";
import { LanguageContext } from "../translations/language";
import {
  setNotificationsEnabled,
  setSoundEnabled,
  setVibrationEnabled,
} from "../utils/appPrefs";
import { t } from "../translations/translation";

// Presentational screen
import SettingsScreen from "../screens/SettingsScreen";

const TOGGLE_KEYS = {
  notifications: "settings:notifications",
  sound: "settings:sound",
  vibration: "settings:vibration",
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

export default function SettingsContainer() {
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
  const [notifications, setNotifications] = useState(true);
  const [sound, setSound] = useState(true);
  const [vibration, setVibration] = useState(true);
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

  // Image source modal
  const [showImageSource, setShowImageSource] = useState(false);

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

  // Reusable uploader for a local image URI
  const handleImageUpload = useCallback(
    async (uri) => {
      if (!session?.user) {
        Alert.alert(
          t("settings.alerts.notSignedInTitle"),
          t("settings.alerts.notSignedInMsg")
        );
        return;
      }

      try {
        const fileExt = (uri.split(".").pop() || "jpg").toLowerCase();
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `${session.user.id}/${fileName}`;
        const bucket = "avatars";

        const formData = new FormData();
        formData.append("file", {
          uri,
          name: fileName,
          type: `image/${fileExt}`,
        });

        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();
        const accessToken = currentSession?.access_token;
        if (!accessToken) throw new Error("No access token available");

        const uploadRes = await fetch(
          `https://litprnfjvytjttlqyhlj.supabase.co/storage/v1/object/${bucket}/${filePath}`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
            body: formData,
          }
        );

        if (!uploadRes.ok) {
          const errorText = await uploadRes.text();
          throw new Error(`Upload failed: ${errorText}`);
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from(bucket).getPublicUrl(filePath);

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ avatar_url: publicUrl })
          .eq("id", session.user.id);
        if (updateError) throw updateError;

        setAvatarUrl(publicUrl);
        setProfile((p) => (p ? { ...p, avatar_url: publicUrl } : p));
        Alert.alert(
          t("settings.alerts.successTitle"),
          t("settings.alerts.avatarUpdated")
        );
      } catch (error) {
        console.error("Upload error:", error);
        Alert.alert(
          t("settings.alerts.uploadFailed"),
          error.message || t("settings.alerts.failedPickImage")
        );
      }
    },
    [session?.user]
  );

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
  const userDisplay =
    profile?.username || session?.user?.email || t("settings.generic.guest");
  const email = session?.user?.email || "";

  /* ---------- Actions ---------- */
  const onLogout = useCallback(() => {
    Alert.alert(
      t("settings.alerts.logoutTitle"),
      t("settings.alerts.logoutConfirm"),
      [
        { text: t("settings.generic.cancel"), style: "cancel" },
        {
          text: t("settings.labels.logout"),
          style: "destructive",
          onPress: async () => {
            await supabase.auth.signOut();
          },
        },
      ]
    );
  }, []);

  const onChangePassword = useCallback(async () => {
    if (!newPassword) return;
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      Alert.alert(
        t("settings.alerts.successTitle"),
        t("settings.alerts.passwordUpdated")
      );
      setShowPassword(false);
      setNewPassword("");
    } catch (e) {
      Alert.alert(
        t("settings.alerts.error"),
        e.message || t("settings.alerts.failedUpdatePassword")
      );
    }
  }, [newPassword]);

  // ⚠️ Camera & Gallery logic UNCHANGED (verbatim)
  const pickAndUploadAvatar = useCallback(async () => {
    if (!session?.user) {
      return Alert.alert(
        t("settings.alerts.notSignedInTitle"),
        t("settings.alerts.notSignedInMsg")
      );
    }

    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;
      await handleImageUpload(result.assets[0].uri);
    } catch (error) {
      console.error("Picker error:", error);
      Alert.alert(
        t("settings.alerts.error"),
        t("settings.alerts.failedPickImage")
      );
    }
  }, [session?.user, handleImageUpload]);

  const openCamera = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        return Alert.alert(
          t("settings.alerts.permissionDeniedTitle"),
          t("settings.alerts.cameraAccessRequired")
        );
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.length) {
        await handleImageUpload(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Camera error:", error);
      Alert.alert(
        t("settings.alerts.error"),
        t("settings.alerts.failedOpenCamera")
      );
    }
  }, [session?.user]);

  const chooseFromGallery = useCallback(async () => {
    setShowImageSource(false);
    await pickAndUploadAvatar();
  }, [pickAndUploadAvatar]);

  const chooseFromCamera = useCallback(async () => {
    setShowImageSource(false);
    await openCamera();
  }, [openCamera]);

  const pickImage = useCallback(() => {
    setShowImageSource(true);
  }, []);

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
        return Alert.alert(
          t("settings.alerts.usernameTakenTitle"),
          t("settings.alerts.usernameTakenMsg")
        );
      }
    }

    const nameFinal = (editName ?? "").trim() || profile?.name || "";
    const usernameFinal =
      (editUsername ?? "").trim() || profile?.username || "";
    const payload = {
      id: session.user.id,
      email: session.user.email,
      name: nameFinal,
      username: usernameFinal,
      region,
    };
    const { error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" });
    if (error) return Alert.alert(t("settings.alerts.error"), error.message);
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

  const detectRegion = useCallback(async () => {
    if (loadingRegion) return;
    setLoadingRegion(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          t("settings.alerts.permissionNeededTitle"),
          t("settings.alerts.regionPermMsg")
        );
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        maximumAge: 0,
      });

      const places = await Location.reverseGeocodeAsync(pos.coords);
      if (!places?.length) {
        Alert.alert(
          t("settings.alerts.oops"),
          t("settings.alerts.cannotDetectRegion")
        );
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
      Alert.alert(
        t("settings.alerts.error"),
        e.message || t("settings.alerts.failedDetectRegion")
      );
    } finally {
      setLoadingRegion(false);
    }
  }, [loadingRegion, session?.user?.id]);

  // Contacts helpers
  const resetContactForm = () => {
    setEditingId(null);
    setCName("");
    setCRelation("");
    setCPhone("");
  };
  const openAddContact = () => {
    if (contacts.length >= MAX_CONTACTS) {
      return Alert.alert(
        t("settings.contacts.limitReachedTitle"),
        t("settings.contacts.limitReachedMsg", { max: MAX_CONTACTS })
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
    Alert.alert(
      t("settings.contacts.deleteTitle"),
      t("settings.contacts.deleteMsg"),
      [
        { text: t("settings.generic.cancel"), style: "cancel" },
        {
          text: t("settings.generic.delete"),
          style: "destructive",
          onPress: () => {
            const next = contacts.filter((c) => c.id !== id);
            saveContacts(next);
          },
        },
      ]
    );
  };
  const saveContact = () => {
    if (!cName.trim() || !cPhone.trim()) {
      return Alert.alert(
        t("settings.contacts.missingInfoTitle"),
        t("settings.contacts.missingInfoMsg")
      );
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
  const call = (phone) => Linking.openURL(`tel:${phone}`); // Linking is only used in screen via handler; we can pass a wrapper
  const onCall = (phone) => {
    // pass to screen
    // we keep it here for parity with old behavior
    // eslint-disable-next-line no-undef
    return Linking.openURL(`tel:${phone}`);
  };

  // Navigation wrapper for screen
  const goToCertificates = () => navigation.navigate("Certificates");

  const vm = {
    // i18n
    lang,
    setLang,
    t,

    // layout
    insets,
    Logo1,
    DefaultProfileImage,

    // auth/profile
    session,
    profile,
    userDisplay,
    email,

    // toggles
    notifications,
    setNotifications: (v) => {
      setNotifications(v);
      setNotificationsEnabled(v);
    },
    sound,
    setSound: (v) => {
      setSound(v);
      setSoundEnabled(v);
    },
    vibration,
    setVibration: (v) => {
      setVibration(v);
      setVibrationEnabled(v);
    },
    mockLocation,
    setMockLocation: (v) => {
      setMockLocation(v);
      persistToggle(TOGGLE_KEYS.mockLocation, v);
    },
    mockDisaster,
    setMockDisaster: (v) => {
      setMockDisaster(v);
      persistToggle(TOGGLE_KEYS.mockDisaster, v);
    },

    // region
    region,
    loadingRegion,
    detectRegion,
    spinAnim,

    // language modal
    showLang,
    setShowLang,

    // password modal
    showPassword,
    setShowPassword,
    newPassword,
    setNewPassword,
    onChangePassword,

    // edit profile modal
    showEditProfile,
    setShowEditProfile,
    editName,
    setEditName,
    editUsername,
    setEditUsername,
    avatarUrl,
    setAvatarUrl,
    openEditProfile,
    saveProfile,
    pickImage, // opens image source modal

    // image source modal
    showImageSource,
    setShowImageSource,
    chooseFromGallery,
    chooseFromCamera,

    // contacts
    contacts,
    showContacts,
    setShowContacts,
    showContactForm,
    setShowContactForm,
    editingId,
    cName,
    setCName,
    cRelation,
    setCRelation,
    cPhone,
    setCPhone,
    openAddContact,
    openEditContact,
    deleteContact,
    saveContact,
    onCall,

    // account
    onLogout,

    // navigation
    goToCertificates,
  };

  return <SettingsScreen vm={vm} />;
}
