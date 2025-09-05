// screens/SettingsScreen.js
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Switch,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

// Reusable components
import SectionTitle from "../components/SectionTitle";
import CardRow from "../components/CardRow";
import ModalButton from "../components/ModalButton";
import ContactRow from "../components/ContactRow";
import CenterModal from "../components/CenterModal";

export default function SettingsScreen({ vm }) {
  const {
    // i18n
    t,
    lang,
    setLang,

    // layout
    insets,
    Logo1,
    DefaultProfileImage,

    // auth/profile
    userDisplay,
    email,

    // toggles
    notifications,
    setNotifications,
    sound,
    setSound,
    vibration,
    setVibration,
    mockLocation,
    setMockLocation,
    mockDisaster,
    setMockDisaster,

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
    openEditProfile,
    pickImage,
    saveProfile,

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
  } = vm;

  return (
    <LinearGradient colors={["#f8fafc", "#eef2ff"]} style={{ flex: 1 }}>
      {/* Brand header */}
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16 }}>
        <View style={styles.brandRow}>
          <Image source={Logo1} style={styles.brandLogo} />
          <Text style={styles.brandTitle}>{t("settings.title")}</Text>
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
        <SectionTitle>{t("settings.sections.game")}</SectionTitle>
        <CardRow
          icon="notifications"
          label={t("settings.labels.notifications")}
          right={
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              ios_backgroundColor="#e5e7eb"
              trackColor={{ false: "#e5e7eb", true: "#a5b4fc" }}
              thumbColor="#6366F1"
            />
          }
        />
        <CardRow
          icon="volume-high"
          label={t("settings.labels.sound")}
          right={
            <Switch
              value={sound}
              onValueChange={setSound}
              ios_backgroundColor="#e5e7eb"
              trackColor={{ false: "#e5e7eb", true: "#a5b4fc" }}
              thumbColor="#6366F1"
            />
          }
        />
        <CardRow
          icon="phone-portrait"
          label={t("settings.labels.vibration")}
          right={
            <Switch
              value={vibration}
              onValueChange={setVibration}
              ios_backgroundColor="#e5e7eb"
              trackColor={{ false: "#e5e7eb", true: "#a5b4fc" }}
              thumbColor="#6366F1"
            />
          }
        />

        {/* Language & Certificates */}
        <SectionTitle>{t("settings.sections.langCert")}</SectionTitle>
        <CardRow
          icon="language"
          label={t("settings.labels.language", { code: lang.toUpperCase() })}
          onPress={() => setShowLang(true)}
          chevron
        />
        <CardRow
          icon="document-text"
          label={t("settings.labels.certificates")}
          onPress={goToCertificates}
          chevron
        />

        {/* Demo toggles */}
        <SectionTitle>{t("settings.sections.demo")}</SectionTitle>
        <CardRow
          icon="location"
          label={t("settings.labels.useMockLocation")}
          right={
            <Switch
              value={mockLocation}
              onValueChange={setMockLocation}
              ios_backgroundColor="#e5e7eb"
              trackColor={{ false: "#e5e7eb", true: "#a5b4fc" }}
              thumbColor="#6366F1"
            />
          }
        />
        <CardRow
          icon="warning"
          label={t("settings.labels.mockDisaster")}
          right={
            <Switch
              value={mockDisaster}
              onValueChange={setMockDisaster}
              ios_backgroundColor="#e5e7eb"
              trackColor={{ false: "#e5e7eb", true: "#a5b4fc" }}
              thumbColor="#6366F1"
            />
          }
        />

        {/* Region detect */}
        <TouchableOpacity
          style={[styles.regionCard, loadingRegion && { opacity: 0.6 }]}
          onPress={loadingRegion ? undefined : detectRegion}
          activeOpacity={loadingRegion ? 1 : 0.8}
        >
          <View style={styles.regionInner}>
            <View style={styles.regionLeft}>
              <Ionicons
                name="earth"
                size={18}
                color="#111827"
                style={{ marginRight: 10 }}
              />
              <Text style={styles.rowText}>
                {t("settings.labels.region")}{" "}
                <Text style={styles.regionValue}>
                  {region || t("settings.labels.tapToDetect")}
                </Text>
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

        {/* Contacts entry */}
        <SectionTitle>{t("settings.sections.contactsList")}</SectionTitle>
        <CardRow
          icon="people"
          label={t("settings.labels.emergencyContacts")}
          onPress={() => setShowContacts(true)}
          chevron
        />

        {/* Account */}
        <SectionTitle>{t("settings.sections.account")}</SectionTitle>
        <CardRow
          icon="key"
          label={t("settings.labels.changePassword")}
          onPress={() => setShowPassword(true)}
          chevron
        />
        <CardRow
          icon="log-out"
          label={t("settings.labels.logout")}
          onPress={onLogout}
          chevron
        />

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Language modal */}
      <CenterModal visible={showLang} onClose={() => setShowLang(false)}>
        <Text style={styles.modalTitle}>{t("settings.langModal.title")}</Text>
        <ModalButton
          text={t("settings.langModal.en")}
          onPress={() => {
            setLang("en");
            setShowLang(false);
          }}
        />
        <ModalButton
          text={t("settings.langModal.zh")}
          onPress={() => {
            setLang("zh");
            setShowLang(false);
          }}
        />
        <ModalButton
          text={t("settings.langModal.ms")}
          onPress={() => {
            setLang("ms");
            setShowLang(false);
          }}
        />
        <ModalButton
          text={t("settings.langModal.ta")}
          onPress={() => {
            setLang("ta");
            setShowLang(false);
          }}
        />
        <ModalButton
          text={t("settings.langModal.close")}
          variant="secondary"
          onPress={() => setShowLang(false)}
        />
      </CenterModal>

      {/* Change password modal */}
      <CenterModal
        visible={showPassword}
        onClose={() => setShowPassword(false)}
      >
        <Text style={styles.modalTitle}>
          {t("settings.passwordModal.title")}
        </Text>
        <View style={styles.inputWrap}>
          <Ionicons
            name="lock-closed"
            size={18}
            color="#6b7280"
            style={{ marginRight: 6 }}
          />
          <TextInput
            placeholder={t("settings.passwordModal.placeholder")}
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            style={{ flex: 1 }}
          />
        </View>
        <ModalButton
          text={t("settings.passwordModal.update")}
          onPress={onChangePassword}
        />
        <ModalButton
          text={t("settings.passwordModal.cancel")}
          variant="secondary"
          onPress={() => setShowPassword(false)}
        />
      </CenterModal>

      {/* Edit profile modal */}
      <CenterModal
        visible={showEditProfile}
        onClose={() => setShowEditProfile(false)}
      >
        <Text style={styles.editTitle}>{t("settings.profile.editTitle")}</Text>

        <View style={{ alignItems: "center", marginTop: 4, marginBottom: 16 }}>
          <Image
            source={avatarUrl ? { uri: avatarUrl } : DefaultProfileImage}
            style={styles.editAvatarLarge}
          />
          <TouchableOpacity onPress={pickImage} style={styles.smallBtn}>
            <Text style={styles.smallBtnText}>
              {t("settings.profile.changePhoto")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Name */}
        <View style={styles.pillInput}>
          <Ionicons
            name="person"
            size={18}
            color="#6b7280"
            style={styles.inputIcon}
          />
          <TextInput
            placeholder={t("settings.profile.name")}
            value={editName}
            onChangeText={setEditName}
            style={styles.pillField}
            placeholderTextColor="#9ca3af"
          />
        </View>

        {/* Username */}
        <View style={styles.pillInput}>
          <Ionicons
            name="at"
            size={18}
            color="#6b7280"
            style={styles.inputIcon}
          />
          <TextInput
            placeholder={t("settings.profile.username")}
            autoCapitalize="none"
            value={editUsername}
            onChangeText={setEditUsername}
            style={styles.pillField}
            placeholderTextColor="#9ca3af"
          />
        </View>

        <ModalButton text={t("settings.profile.save")} onPress={saveProfile} />
        <ModalButton
          text={t("settings.profile.cancel")}
          variant="secondary"
          onPress={() => setShowEditProfile(false)}
        />
      </CenterModal>

      {/* Contacts modal */}
      <CenterModal
        visible={showContacts}
        onClose={() => setShowContacts(false)}
      >
        <Text style={styles.modalTitle}>{t("settings.contacts.title")}</Text>

        {contacts.map((c) => (
          <ContactRow
            key={c.id}
            name={c.name}
            relation={c.relation}
            phone={c.phone}
            onCall={() => onCall(c.phone)}
            onEdit={() => openEditContact(c)}
            onDelete={() => deleteContact(c.id)}
          />
        ))}

        {/* Add contact button with limit */}
        <TouchableOpacity
          style={[
            styles.modalBtn,
            {
              marginTop: 14,
              backgroundColor: contacts.length >= 5 ? "#9ca3af" : "#22c55e",
            },
          ]}
          onPress={openAddContact}
          disabled={contacts.length >= 5}
          activeOpacity={contacts.length >= 5 ? 1 : 0.9}
        >
          <Text style={styles.modalBtnText}>
            {t("settings.contacts.addContactBtn", {
              count: contacts.length,
              max: 5,
            })}
          </Text>
        </TouchableOpacity>

        <ModalButton
          text={t("settings.contacts.close")}
          variant="secondary"
          onPress={() => setShowContacts(false)}
        />
      </CenterModal>

      {/* Add/Edit contact form */}
      <CenterModal
        visible={showContactForm}
        onClose={() => setShowContactForm(false)}
      >
        <Text style={styles.modalTitle}>
          {editingId
            ? t("settings.contacts.editTitle")
            : t("settings.contacts.addTitle")}
        </Text>
        <View style={styles.inputWrap}>
          <Ionicons
            name="person"
            size={18}
            color="#6b7280"
            style={{ marginRight: 6 }}
          />
          <TextInput
            placeholder={t("settings.contacts.fullName")}
            value={cName}
            onChangeText={setCName}
            style={{ flex: 1 }}
          />
        </View>
        <View style={[styles.inputWrap, { marginTop: 10 }]}>
          <Ionicons
            name="heart"
            size={18}
            color="#6b7280"
            style={{ marginRight: 6 }}
          />
          <TextInput
            placeholder={t("settings.contacts.relation")}
            value={cRelation}
            onChangeText={setCRelation}
            style={{ flex: 1 }}
          />
        </View>
        <View style={[styles.inputWrap, { marginTop: 10 }]}>
          <Ionicons
            name="call"
            size={18}
            color="#6b7280"
            style={{ marginRight: 6 }}
          />
          <TextInput
            placeholder={t("settings.contacts.phone")}
            keyboardType="phone-pad"
            value={cPhone}
            onChangeText={setCPhone}
            style={{ flex: 1 }}
          />
        </View>
        <ModalButton
          text={
            editingId ? t("settings.contacts.save") : t("settings.contacts.add")
          }
          onPress={saveContact}
        />
        <ModalButton
          text={t("settings.contacts.cancel")}
          variant="secondary"
          onPress={() => setShowContactForm(false)}
        />
      </CenterModal>

      {/* Image source modal */}
      <CenterModal
        visible={showImageSource}
        onClose={() => setShowImageSource(false)}
      >
        <Text style={styles.modalTitle}>{t("settings.imageSource.title")}</Text>

        <View style={styles.optionRow}>
          <TouchableOpacity
            style={styles.optionCard}
            activeOpacity={0.9}
            onPress={chooseFromGallery}
          >
            <View style={styles.optionIconWrap}>
              <Ionicons name="images-outline" size={28} color="#2563eb" />
            </View>
            <Text style={styles.optionLabel}>
              {t("settings.imageSource.gallery")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionCard}
            activeOpacity={0.9}
            onPress={chooseFromCamera}
          >
            <View style={styles.optionIconWrap}>
              <Ionicons name="camera-outline" size={28} color="#2563eb" />
            </View>
            <Text style={styles.optionLabel}>
              {t("settings.imageSource.camera")}
            </Text>
          </TouchableOpacity>
        </View>

        <ModalButton
          text={t("settings.imageSource.cancel")}
          variant="secondary"
          onPress={() => setShowImageSource(false)}
        />
      </CenterModal>
    </LinearGradient>
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

  // reused row text style (CardRow provides most styles)
  rowText: { color: "#111827", fontWeight: "600", fontSize: 15, flexShrink: 1 },

  // Region detect
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

  // Modals
  modalTitle: {
    fontWeight: "800",
    fontSize: 16,
    marginBottom: 10,
    color: "#111827",
    textAlign: "center",
  },
  modalBtn: {
    backgroundColor: "#22c55e",
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

  // Edit Profile
  editTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 8,
  },
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

  // Image source options
  optionRow: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
    marginBottom: 6,
  },
  optionCard: {
    flex: 1,
    backgroundColor: "#F5F7FB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6E9F2",
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  optionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  optionLabel: { fontSize: 14, fontWeight: "700", color: "#111827" },

  // Inputs (pill)
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
});
