// chatbot.js
import { useState, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  ActivityIndicator, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from './language';
import translations from './translations';

const OPENROUTER_API_KEY = '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';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export default function ChatbotScreen() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPresets, setShowPresets] = useState(true);
  const scrollViewRef = useRef();
  const { lang } = useLanguage();
  const t = (key) => translations[lang][key] || key;
  const presetQuestions = translations[lang].presetQuestions || [];

  const sendMessage = async (text = input) => {
    if (!text.trim()) return;

    const userMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://your-app.com',
          'X-Title': 'DisasterChatApp',
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-chat-v3-0324:free',
          messages: updatedMessages,
        }),
      });

      const data = await response.json();
      const aiReply = data.choices?.[0]?.message?.content || '⚠️ No response.';
      setMessages([...updatedMessages, { role: 'assistant', content: aiReply }]);
    } catch (err) {
      setMessages([...updatedMessages, { role: 'assistant', content: `❌ Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.chatContainer}
          ref={scrollViewRef}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((msg, idx) => (
            <View key={idx} style={[styles.message, msg.role === 'user' ? styles.user : styles.ai]}>
              <Text>{msg.content}</Text>
            </View>
          ))}
          {loading && (
            <View style={[styles.message, styles.ai]}>
              <Text>🤖 {(t('typing') !== 'typing' && t('typing')) || 'Bot is typing...'}</Text>
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          onPress={() => setShowPresets(!showPresets)}
          style={styles.toggleButton}
        >
          <Text style={styles.toggleText}>
            {showPresets ? '⬇️ Hide Suggestions' : '⬆️ Show Suggestions'}
          </Text>
        </TouchableOpacity>

        {showPresets && (
          <View style={styles.quickRow}>
            {presetQuestions.map((q, i) => (
              <TouchableOpacity key={i} style={styles.quickBtn} onPress={() => sendMessage(q)}>
                <Text style={styles.quickText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.inputRow}>
         <TextInput
           style={styles.input}
           placeholder={(t('askQuestion') !== 'askQuestion' && t('askQuestion')) || 'Type your question here...'}
           value={input}
           onChangeText={setInput}
           editable={!loading}
           returnKeyType="send"
           onSubmitEditing={() => !loading && input.trim() && sendMessage()}
         />
          <TouchableOpacity
            onPress={() => sendMessage()}
            disabled={loading || !input.trim()}
            accessibilityLabel="Send message"
            style={styles.sendBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
           <Ionicons name="send" size={18} color="#fff" />
         </TouchableOpacity>
       </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    padding: 10,
  },
  chatContainer: {
    paddingBottom: 20,
    paddingTop: 10,
  },
  message: {
    padding: 10,
    marginVertical: 5,
    borderRadius: 12,
    maxWidth: '80%',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  user: {
    alignSelf: 'flex-end',
    backgroundColor: '#D0F0FD',
  },
  ai: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0EAD6',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    backgroundColor: '#f9f9f9',
    paddingLeft: 12,
    paddingRight: 6,
    marginBottom: 10,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  quickRow: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  quickBtn: {
    backgroundColor: '#d0e8f2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginVertical: 4,
    maxWidth: '90%',
  },
  quickText: {
    fontSize: 14,
    textAlign: 'center',
  },
  toggleButton: {
    alignSelf: 'center',
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#eee',
    borderRadius: 20,
  },
  toggleText: {
    fontSize: 12,
    color: '#333',
  },
});
