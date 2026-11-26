import UIKit
import WebKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, configurationForConnecting session: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let configuration = UISceneConfiguration(name: "UniLink", sessionRole: session.role)
        configuration.delegateClass = SceneDelegate.self
        return configuration
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
        guard let scene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: scene)
        window.rootViewController = WorkspaceController()
        self.window = window
        window.makeKeyAndVisible()
    }
}

final class WorkspaceController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private let start = URL(string: "https://unilink-frontend-omky.onrender.com/dashboard")!
    private var web: WKWebView!
    private let retryPanel = UIStackView()
    private var lastPage: URL?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        let configuration = WKWebViewConfiguration()
        configuration.applicationNameForUserAgent = "UniLinkNative/1"
        web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = true
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            web.leadingAnchor.constraint(equalTo: safe.leadingAnchor), web.trailingAnchor.constraint(equalTo: safe.trailingAnchor),
            web.topAnchor.constraint(equalTo: safe.topAnchor), web.bottomAnchor.constraint(equalTo: safe.bottomAnchor)
        ])

        let message = UILabel()
        message.text = "UniLink couldn’t reach your workspace."
        message.textAlignment = .center
        message.numberOfLines = 0
        let retry = UIButton(type: .system)
        retry.setTitle("Try again", for: .normal)
        retry.addTarget(self, action: #selector(loadWorkspace), for: .touchUpInside)
        retryPanel.axis = .vertical
        retryPanel.spacing = 12
        retryPanel.addArrangedSubview(message)
        retryPanel.addArrangedSubview(retry)
        retryPanel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(retryPanel)
        NSLayoutConstraint.activate([
            retryPanel.centerYAnchor.constraint(equalTo: safe.centerYAnchor),
            retryPanel.leadingAnchor.constraint(equalTo: safe.leadingAnchor, constant: 24),
            retryPanel.trailingAnchor.constraint(equalTo: safe.trailingAnchor, constant: -24)
        ])
        loadWorkspace()
    }

    @objc private func loadWorkspace() {
        retryPanel.isHidden = true
        web.isHidden = false
        web.load(URLRequest(url: lastPage ?? start))
    }

    private func showRetry() {
        web.isHidden = true
        retryPanel.isHidden = false
    }

    private func isWorkspace(_ url: URL) -> Bool {
        url.scheme == "https" && url.host?.lowercased() == start.host && (url.port == nil || url.port == 443)
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard action.targetFrame?.isMainFrame != false, let url = action.request.url else {
            decisionHandler(.allow)
            return
        }
        if isWorkspace(url) {
            if action.targetFrame == nil {
                decisionHandler(.cancel)
                webView.load(action.request)
            } else {
                lastPage = url
                decisionHandler(.allow)
            }
        } else {
            decisionHandler(.cancel)
            if url.scheme == "https" || url.scheme == "mailto" { UIApplication.shared.open(url) }
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if response.isForMainFrame, let http = response.response as? HTTPURLResponse, http.statusCode >= 500 {
            decisionHandler(.cancel)
            showRetry()
        } else {
            decisionHandler(.allow)
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { showRetry() }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { showRetry() }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { showRetry() }
}
