import UIKit
import Capacitor
import WebKit

class KiddaBridgeViewController: CAPBridgeViewController {
    private let navigationProxy = KiddaNavigationProxy()
    private var launchRetries = 0
    private var launchSettled = false
    private var retryWork: DispatchWorkItem?
    private let launchURL = URL(string: "https://webapp.kidda.app")!

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        webView?.allowsBackForwardNavigationGestures = true
        // Capacitor's own delegate loads errorPath on every failure, including the
        // -999 that a same-host redirect produces. Take the delegate first so that
        // page never replaces the real navigation.
        navigationProxy.owner = self
        navigationProxy.forward = webView?.navigationDelegate
        webView?.navigationDelegate = navigationProxy
    }

    fileprivate func webViewDidFinish(_ webView: WKWebView, navigation: WKNavigation!) {
        guard webView.url?.host == "webapp.kidda.app" else { return }
        launchSettled = true
        launchRetries = 0
        retryWork?.cancel()
        navigationProxy.forward?.webView?(webView, didFinish: navigation)
    }

    fileprivate func webViewDidFail(_ webView: WKWebView, error: Error) {
        let nsError = error as NSError
        let failing = (nsError.userInfo[NSURLErrorFailingURLStringErrorKey] as? String) ?? ""
        NSLog("Kidda webview fail domain=%@ code=%ld url=%@", nsError.domain, nsError.code, failing)

        // A redirect cancels the first provisional navigation. The follow-up load is already running.
        if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled {
            return
        }

        if launchSettled || launchRetries >= 3 {
            showOffline(on: webView)
            return
        }

        launchRetries += 1
        // Replace WebKit's error document immediately, then retry the app under the splash.
        webView.loadHTMLString("<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head><body style=\"margin:0;background:#fff\"></body></html>", baseURL: nil)
        retryWork?.cancel()
        let work = DispatchWorkItem { [weak self, weak webView] in
            guard let self, let webView, !self.launchSettled else { return }
            webView.load(URLRequest(url: self.launchURL))
        }
        retryWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 1, execute: work)
    }

    private func showOffline(on webView: WKWebView) {
        let bundled = Bundle.main.url(forResource: "offline", withExtension: "html", subdirectory: "public")
            ?? Bundle.main.url(forResource: "offline", withExtension: "html")
        if let bundled {
            webView.loadFileURL(bundled, allowingReadAccessTo: bundled.deletingLastPathComponent())
            return
        }
        webView.loadHTMLString("<!doctype html><html><body style=\"font-family:-apple-system;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#fff\">Connecting…</body></html>", baseURL: nil)
    }
}

/// Forwards Capacitor's navigation delegate, except the two failure callbacks.
private final class KiddaNavigationProxy: NSObject, WKNavigationDelegate {
    weak var owner: KiddaBridgeViewController?
    weak var forward: WKNavigationDelegate?

    override func responds(to aSelector: Selector!) -> Bool {
        if super.responds(to: aSelector) { return true }
        return forward?.responds(to: aSelector) ?? false
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        if let forward, forward.responds(to: aSelector) {
            return forward
        }
        return super.forwardingTarget(for: aSelector)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        owner?.webViewDidFinish(webView, navigation: navigation)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        owner?.webViewDidFail(webView, error: error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        owner?.webViewDidFail(webView, error: error)
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        // The storyboard already installs KiddaBridgeViewController. A second
        // window starts a second load and cancels the first one.
        if let existing = windowScene.windows.first {
            window = existing
        } else {
            let created = UIWindow(windowScene: windowScene)
            created.rootViewController = KiddaBridgeViewController()
            created.makeKeyAndVisible()
            window = created
        }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
