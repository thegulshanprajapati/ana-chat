import React, { useState } from "react";
import { 
  SafeAreaView, 
  StatusBar, 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Image
} from "react-native";

export default function App() {
  const [activeTab, setActiveTab] = useState("chats");
  
  const contacts = [
    { id: "1", name: "Aditya", avatar: "AS", online: true },
    { id: "2", name: "Priya", avatar: "PP", online: true },
    { id: "3", name: "Rohit", avatar: "RV", online: false },
    { id: "4", name: "Siddharth", avatar: "SR", online: true },
    { id: "5", name: "Karan", avatar: "KD", online: false }
  ];

  const recentChats = [
    { id: "1", name: "Aditya Sharma", message: "Sure, let's meet at 5 PM today.", time: "12:30 PM", unread: 2, avatar: "AS" },
    { id: "2", name: "Priya Patel", message: "Did you review the database design?", time: "10:45 AM", unread: 0, avatar: "PP" },
    { id: "3", name: "Rohit Verma", message: "The build is successful on desktop client.", time: "Yesterday", unread: 0, avatar: "RV" },
    { id: "4", name: "AnaChat Security", message: "E2E keys rotated successfully.", time: "2 days ago", unread: 0, avatar: "AC" }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Mobile Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>AnaChat</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>🔒 SECURE</Text>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>End-to-End Encrypted Messaging</Text>
      </View>

      {/* Contacts Carousel */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>ONLINE CONTACTS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.contactsScroll}>
          {contacts.map(contact => (
            <TouchableOpacity key={contact.id} style={styles.contactCard}>
              <View style={styles.avatarContainer}>
                <View style={[styles.avatar, { backgroundColor: contact.online ? "#0369a1" : "#334155" }]}>
                  <Text style={styles.avatarText}>{contact.avatar}</Text>
                </View>
                {contact.online && <View style={styles.onlineDot} />}
              </View>
              <Text style={styles.contactName} numberOfLines={1}>{contact.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Chats Section */}
      <View style={[styles.sectionContainer, { flex: 1, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: "#0f172a", marginTop: 10 }]}>
        <View style={styles.chatSectionHeader}>
          <Text style={[styles.sectionTitle, { color: "#f8fafc" }]}>RECENT MESSAGES</Text>
        </View>
        
        <ScrollView contentContainerStyle={styles.chatsScroll}>
          {recentChats.map(chat => (
            <TouchableOpacity key={chat.id} style={styles.chatItem}>
              <View style={[styles.chatAvatar, { backgroundColor: chat.unread > 0 ? "#0284c7" : "#1e293b" }]}>
                <Text style={styles.chatAvatarText}>{chat.avatar}</Text>
              </View>
              
              <View style={styles.chatInfo}>
                <View style={styles.chatRow}>
                  <Text style={styles.chatNameText}>{chat.name}</Text>
                  <Text style={styles.chatTimeText}>{chat.time}</Text>
                </View>
                <View style={styles.chatRow}>
                  <Text style={styles.chatMessageText} numberOfLines={1}>{chat.message}</Text>
                  {chat.unread > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{chat.unread}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Custom Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab("chats")}>
          <Text style={[styles.tabText, activeTab === "chats" && styles.tabActiveText]}>💬 Chats</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab("contacts")}>
          <Text style={[styles.tabText, activeTab === "contacts" && styles.tabActiveText]}>👤 Contacts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab("settings")}>
          <Text style={[styles.tabText, activeTab === "settings" && styles.tabActiveText]}>⚙️ Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617"
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 15
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#f8fafc",
    letterSpacing: 0.5
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4
  },
  statusBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)"
  },
  statusText: {
    color: "#10b981",
    fontSize: 10,
    fontWeight: "700"
  },
  sectionContainer: {
    paddingVertical: 10
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 1.5,
    paddingHorizontal: 20,
    marginBottom: 10
  },
  contactsScroll: {
    paddingHorizontal: 15
  },
  contactCard: {
    alignItems: "center",
    marginHorizontal: 8,
    width: 65
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 6
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)"
  },
  avatarText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14
  },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10b981",
    borderWidth: 2,
    borderColor: "#020617"
  },
  contactName: {
    color: "#94a3b8",
    fontSize: 11,
    textAlign: "center"
  },
  chatSectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 5
  },
  chatsScroll: {
    paddingHorizontal: 20,
    paddingBottom: 20
  },
  chatItem: {
    flexDirection: "row",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.03)",
    alignItems: "center"
  },
  chatAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center"
  },
  chatAvatarText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15
  },
  chatInfo: {
    flex: 1,
    marginLeft: 14
  },
  chatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 2
  },
  chatNameText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f8fafc"
  },
  chatTimeText: {
    fontSize: 11,
    color: "#64748b"
  },
  chatMessageText: {
    fontSize: 13,
    color: "#94a3b8",
    flex: 1,
    paddingRight: 10
  },
  unreadBadge: {
    backgroundColor: "#0284c7",
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5
  },
  unreadText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700"
  },
  tabBar: {
    height: 60,
    flexDirection: "row",
    backgroundColor: "#0b0f19",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    paddingBottom: 5
  },
  tabItem: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  tabText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "500"
  },
  tabActiveText: {
    color: "#38bdf8"
  }
});
