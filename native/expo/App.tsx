import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, type AppStateStatus, BackHandler, Linking, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
const NativeWebView: any = WebView;
type NavigationRequest = { url: string };
import * as Updates from "expo-updates";

const APP_URL = process.env.EXPO_PUBLIC_APP_URL || "https://mohammadfadaiemacbook-coder.github.io/ai-business-core/";
const APP_HOST = "mohammadfadaiemacbook-coder.github.io";

export default function App() {
  const webView = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const checkingUpdate = useRef(false);
  const externalAuthOpened = useRef(false);

  const checkNativeUpdate = useCallback(async () => {
    if (!Updates.isEnabled || checkingUpdate.current) return;
    checkingUpdate.current = true;
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        Alert.alert("به‌روزرسانی آماده است", "نسخه جدید AI Business Core دریافت شود؟", [
          { text: "بعداً", style: "cancel" },
          { text: "به‌روزرسانی", onPress: () => {
            void (async () => {
              try { await Updates.fetchUpdateAsync(); await Updates.reloadAsync(); }
              catch { Alert.alert("خطا", "دریافت به‌روزرسانی انجام نشد."); }
            })();
          }}
        ]);
      }
    } catch {
      // OTA stays disabled until an EAS project is configured.
    } finally { checkingUpdate.current = false; }
  }, []);

  useEffect(() => { void checkNativeUpdate(); }, [checkNativeUpdate]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && externalAuthOpened.current) {
        externalAuthOpened.current = false;
        webView.current?.reload();
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack) { webView.current?.goBack(); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [canGoBack]);

  const handleNavigation = useCallback((request: NavigationRequest) => {
    let url: URL;
    try { url = new URL(request.url); } catch { return false; }
    if (url.protocol !== "https:") return false;
    if (url.hostname === APP_HOST) return true;
    if (url.hostname === "accounts.google.com") externalAuthOpened.current = true;
    void Linking.openURL(request.url).catch(() => Alert.alert("خطا", "باز کردن پیوند امکان‌پذیر نیست."));
    return false;
  }, []);

  const reload = () => { setFailed(false); setLoading(true); webView.current?.reload(); };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.topBar}>
        <Text style={styles.brand}>AI BUSINESS CORE</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="بارگذاری دوباره" onPress={reload} style={styles.refresh}>
          <Text style={styles.refreshText}>تازه‌سازی</Text>
        </TouchableOpacity>
      </View>
      {failed ? (
        <View style={styles.error}>
          <Text style={styles.errorTitle}>اتصال برقرار نشد</Text>
          <Text style={styles.errorText}>اینترنت را بررسی کن و دوباره تلاش کن.</Text>
          <TouchableOpacity onPress={reload} style={styles.retry}><Text style={styles.retryText}>تلاش دوباره</Text></TouchableOpacity>
        </View>
      ) : (
        <NativeWebView ref={webView} source={{ uri: APP_URL }} originWhitelist={["https://*"]}
          onShouldStartLoadWithRequest={handleNavigation}
          injectedJavaScriptBeforeContentLoaded={"window.__AI_BUSINESS_CORE_EXPO__ = true; true;"}
          onNavigationStateChange={(state: { canGoBack: boolean }) => setCanGoBack(state.canGoBack)}
          onLoadStart={() => { setLoading(true); setFailed(false); }}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setFailed(true); }}
          onHttpError={(event: { nativeEvent: { statusCode: number } }) => { if (event.nativeEvent.statusCode >= 500) setFailed(true); }}
          javaScriptEnabled domStorageEnabled sharedCookiesEnabled thirdPartyCookiesEnabled
          allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false}
          setSupportMultipleWindows={false} pullToRefreshEnabled cacheEnabled style={styles.webView} />
      )}
      {loading && !failed && <View style={styles.loading}><ActivityIndicator size="large" color="#60a5fa" /><Text style={styles.loadingText}>در حال بارگذاری فضای کاری…</Text></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:"#0b1120",paddingTop:Platform.OS==="android"?StatusBar.currentHeight||0:0},
  topBar:{height:48,paddingHorizontal:14,backgroundColor:"#101827",borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:"#263449",flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  brand:{color:"#dbeafe",fontSize:12,fontWeight:"800",letterSpacing:1},
  refresh:{paddingHorizontal:12,paddingVertical:7,borderRadius:8,backgroundColor:"#1d4ed8"},
  refreshText:{color:"#fff",fontSize:12,fontWeight:"700"},
  webView:{flex:1,backgroundColor:"#0b1120"},
  loading:{...StyleSheet.absoluteFill,top:48,backgroundColor:"#0b1120",alignItems:"center",justifyContent:"center"},
  loadingText:{color:"#cbd5e1",marginTop:12,fontSize:13},
  error:{flex:1,alignItems:"center",justifyContent:"center",padding:28},
  errorTitle:{color:"#fff",fontSize:20,fontWeight:"800",marginBottom:8},
  errorText:{color:"#94a3b8",textAlign:"center",marginBottom:18},
  retry:{backgroundColor:"#2563eb",paddingHorizontal:20,paddingVertical:11,borderRadius:10},
  retryText:{color:"#fff",fontWeight:"700"}
});
