/**
 * No-Cap Landing Page Styles
 * Extracted from inline styles for CSP compliance
 */

/* ==================== RESET & BASE ==================== */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Poppins', sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    color: white;
    overflow-x: hidden;
}

/* ==================== AGE MODAL ==================== */
.age-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(10px);
}

.age-modal-content {
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(25px);
    border-radius: 20px;
    padding: 30px;
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
}

.age-header {
    text-align: center;
    margin-bottom: 25px;
}

.age-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 15px;
}

.age-header h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 10px;
}

.age-warning {
    background: rgba(255, 193, 7, 0.1);
    border: 1px solid rgba(255, 193, 7, 0.3);
    border-radius: 15px;
    padding: 20px;
    margin-bottom: 25px;
}

.age-warning h3 {
    color: #ffc107;
    font-size: 1.2rem;
    font-weight: 600;
    margin-bottom: 15px;
}

.age-warning p {
    line-height: 1.6;
    margin-bottom: 10px;
}

.legal-note {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.8);
}

.age-verification {
    margin-bottom: 25px;
}

.age-verification h4 {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 15px;
}

.checkbox-container {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
    padding: 15px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.checkbox-container input[type="checkbox"] {
    width: 20px;
    height: 20px;
    cursor: pointer;
}

.checkbox-container label {
    cursor: pointer;
    font-weight: 500;
}

.age-buttons {
    display: flex;
    flex-direction: column;
    gap: 15px;
    align-items: center;
}

.btn-age {
    width: 100%;
    padding: 15px 25px;
    border: none;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    font-family: inherit;
}

.btn-age.primary {
    background: linear-gradient(135deg, #4CAF50, #45a049);
    color: white;
    opacity: 0.5;
}

.btn-age.primary.enabled {
    opacity: 1;
}

.btn-age.primary.enabled:hover {
    box-shadow: 0 5px 20px rgba(76, 175, 80, 0.4);
    transform: translateY(-2px);
}

.btn-age.secondary {
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.3);
    color: white;
}

.btn-age.secondary:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
}

.or-divider {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.7);
    margin: 10px 0;
}

.age-subtitle {
    text-align: center;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.7);
    margin-top: 10px;
}

.responsibility-info,
.help-section {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 15px;
    padding: 20px;
    margin-bottom: 20px;
}

.responsibility-info h4,
.help-section h4 {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 15px;
}

.responsibility-info ul {
    list-style: none;
    padding-left: 0;
}

.responsibility-info li {
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.responsibility-info li:last-child {
    border-bottom: none;
}

.help-section p {
    line-height: 1.6;
}

.modal-footer {
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    padding-top: 20px;
    margin-top: 20px;
}

.footer-links-modal {
    display: flex;
    justify-content: center;
    gap: 20px;
    flex-wrap: wrap;
}

.modal-link {
    color: rgba(255, 255, 255, 0.7);
    text-decoration: none;
    font-size: 0.9rem;
    padding: 8px 15px;
    border-radius: 8px;
    transition: all 0.3s ease;
}

.modal-link:hover {
    color: white;
    background: rgba(255, 255, 255, 0.1);
}

/* ==================== BACKGROUND PARTICLES ==================== */
.background-particles {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    z-index: -1;
}

.particle {
    position: absolute;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    animation: float 8s ease-in-out infinite;
}

.particle:nth-child(1) { width: 60px; height: 60px; left: 10%; animation-delay: 0s; }
.particle:nth-child(2) { width: 80px; height: 80px; left: 80%; animation-delay: 2s; }
.particle:nth-child(3) { width: 40px; height: 40px; left: 30%; animation-delay: 4s; }
.particle:nth-child(4) { width: 100px; height: 100px; left: 70%; animation-delay: 6s; }
.particle:nth-child(5) { width: 50px; height: 50px; left: 50%; animation-delay: 8s; }

@keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.3; }
    50% { transform: translateY(-30px) rotate(180deg); opacity: 0.6; }
}

/* ==================== CONTAINER ==================== */
.app-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

/* ==================== HEADER ==================== */
.site-header {
    text-align: center;
    margin-bottom: 40px;
}

.site-logo {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
}

.logo-icon {
    font-size: 4rem;
    margin-bottom: 10px;
    text-shadow: 0 0 30px rgba(79, 172, 254, 0.5);
}

.site-logo .logo {
    font-size: clamp(3rem, 8vw, 5rem);
    font-weight: 800;
    background: linear-gradient(45deg, #4facfe, #00f2fe);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin: 0;
    text-shadow: 0 0 30px rgba(79, 172, 254, 0.5);
}

.site-url {
    font-size: 1.2rem;
    color: rgba(255, 255, 255, 0.8);
    font-weight: 600;
    margin: 0;
}

/* ==================== MAIN CONTENT ==================== */
.main-content {
    flex: 1;
}

/* ==================== HERO SECTION ==================== */
.hero-section {
    text-align: center;
    margin-bottom: 60px;
    min-height: 50vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.hero-title {
    font-size: clamp(1.8rem, 5vw, 2.5rem);
    font-weight: 700;
    margin-bottom: 15px;
    color: white;
}

.hero-subtitle {
    font-size: 1.2rem;
    color: rgba(255, 255, 255, 0.8);
    margin-bottom: 40px;
    font-weight: 300;
}

.game-features {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 30px;
    margin: 40px 0;
}

.feature {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(255, 255, 255, 0.1);
    padding: 15px 20px;
    border-radius: 25px;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    transition: all 0.3s ease;
}

.feature:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
}

.feature-icon {
    font-size: 1.5rem;
}

.feature-text {
    font-weight: 500;
    font-size: 0.95rem;
}

/* ==================== SCROLL INDICATOR ==================== */
.scroll-indicator {
    margin-top: 40px;
    cursor: pointer;
    opacity: 0.7;
    transition: all 0.3s ease;
}

.scroll-indicator:hover {
    opacity: 1;
    transform: translateY(-2px);
}

.scroll-text {
    font-size: 0.9rem;
    margin-bottom: 10px;
    color: rgba(255, 255, 255, 0.8);
}

.scroll-arrow {
    font-size: 1.5rem;
    animation: bounce 2s infinite;
}

@keyframes bounce {
    0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-10px); }
    60% { transform: translateY(-5px); }
}

/* ==================== SECTIONS ==================== */
.section-title {
    text-align: center;
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 40px;
    color: white;
}

/* ==================== GAME MODES ==================== */
.game-modes {
    margin-bottom: 80px;
}

.mode-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 30px;
    max-width: 1000px;
    margin: 0 auto;
}

.mode-card {
    background: rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(25px);
    border-radius: 20px;
    padding: 30px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
}

.mode-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
    border-color: rgba(79, 172, 254, 0.5);
}

.mode-card.featured {
    border: 2px solid #4facfe;
    box-shadow: 0 0 30px rgba(79, 172, 254, 0.3);
}

.featured-badge {
    position: absolute;
    top: 15px;
    right: 15px;
    background: linear-gradient(135deg, #4facfe, #00f2fe);
    color: white;
    padding: 5px 12px;
    border-radius: 15px;
    font-size: 0.8rem;
    font-weight: 600;
}

.mode-header {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 20px;
}

.mode-icon {
    font-size: 2.5rem;
}

.mode-title {
    font-size: 1.4rem;
    font-weight: 700;
    color: white;
    margin: 0;
}

.mode-description {
    color: rgba(255, 255, 255, 0.8);
    line-height: 1.6;
    margin-bottom: 20px;
    font-size: 0.95rem;
}

.mode-features {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 25px;
}

.feature-badge {
    background: rgba(76, 175, 80, 0.2);
    border: 1px solid rgba(76, 175, 80, 0.5);
    color: #4CAF50;
    padding: 5px 12px;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
}

.mode-btn {
    width: 100%;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.3);
    color: white;
    padding: 15px;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    font-family: inherit;
}

.mode-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
}

.mode-btn.primary {
    background: linear-gradient(135deg, #4facfe, #00f2fe);
    border-color: #4facfe;
}

.mode-btn.primary:hover {
    box-shadow: 0 5px 20px rgba(79, 172, 254, 0.4);
    transform: translateY(-2px);
}

/* ==================== HOW IT WORKS ==================== */
.how-it-works {
    margin-bottom: 60px;
}

.steps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 30px;
    max-width: 1000px;
    margin: 0 auto;
}

.step {
    display: flex;
    gap: 20px;
    align-items: flex-start;
}

.step-number {
    background: linear-gradient(135deg, #4facfe, #00f2fe);
    color: white;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1.2rem;
    flex-shrink: 0;
}

.step-content h5 {
    color: white;
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 8px;
}

.step-content p {
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.9rem;
    line-height: 1.4;
}

/* ==================== FOOTER ==================== */
.site-footer {
    margin-top: auto;
    padding-top: 40px;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.footer-content {
    text-align: center;
}

.footer-links {
    display: flex;
    justify-content: center;
    gap: 30px;
    margin-bottom: 20px;
    flex-wrap: wrap;
}

.footer-link {
    color: rgba(255, 255, 255, 0.7);
    text-decoration: none;
    font-size: 0.9rem;
    padding: 8px 15px;
    border-radius: 8px;
    transition: all 0.3s ease;
}

.footer-link:hover {
    color: white;
    background: rgba(255, 255, 255, 0.1);
}

.footer-info {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.8rem;
    line-height: 1.5;
}

.website-badge {
    color: #4facfe;
    font-weight: 600;
}

/* ==================== TOAST NOTIFICATIONS ==================== */
.toast-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(25px);
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 20px;
    padding: 20px;
    z-index: 10000;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    max-width: 350px;
    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.2);
}

.toast-notification.show {
    opacity: 1;
    transform: translateX(0);
}

.toast-notification.success {
    border-color: rgba(76, 175, 80, 0.5);
    background: linear-gradient(135deg, rgba(76, 175, 80, 0.15), rgba(76, 175, 80, 0.25));
}

.toast-notification.warning {
    border-color: rgba(255, 152, 0, 0.5);
    background: linear-gradient(135deg, rgba(255, 152, 0, 0.15), rgba(255, 152, 0, 0.25));
}

.toast-notification.error {
    border-color: rgba(244, 67, 54, 0.5);
    background: linear-gradient(135deg, rgba(244, 67, 54, 0.15), rgba(244, 67, 54, 0.25));
}

.toast-notification.info {
    border-color: rgba(33, 150, 243, 0.5);
    background: linear-gradient(135deg, rgba(33, 150, 243, 0.15), rgba(33, 150, 243, 0.25));
}

.toast-content {
    display: flex;
    align-items: center;
    gap: 15px;
    color: white;
}

.toast-icon {
    font-size: 1.5rem;
}

.toast-message {
    font-weight: 600;
    font-size: 0.95rem;
    line-height: 1.4;
}

/* ==================== MOBILE RESPONSIVE ==================== */
@media (max-width: 768px) {
    .app-container {
        padding: 15px;
    }

    .age-modal-content {
        padding: 20px;
        width: 95%;
    }

    .age-buttons {
        gap: 10px;
    }

    .footer-links-modal {
        flex-direction: column;
        gap: 10px;
    }

    .game-features {
        flex-direction: column;
        align-items: center;
    }

    .mode-cards {
        grid-template-columns: 1fr;
    }

    .steps {
        grid-template-columns: 1fr;
    }

    .step {
        flex-direction: column;
        text-align: center;
        gap: 15px;
    }

    .footer-links {
        flex-direction: column;
        gap: 15px;
    }

    .hero-section {
        min-height: 40vh;
    }
}

/* ==================== ACCESSIBILITY ==================== */
.mode-card:focus,
.mode-btn:focus,
.footer-link:focus,
.btn-age:focus {
    outline: 2px solid #4facfe;
    outline-offset: 2px;
}

/* ==================== REDUCED MOTION ==================== */
@media (prefers-reduced-motion: reduce) {
    * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }

    .scroll-arrow {
        animation: none;
    }
}