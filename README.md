# Auftragsmanager Pro - Telegram Mini Web App

Eine vollständige Telegram Mini-Web-App für das Auftragsmanagement mit n8n-Integration und Google Sheets-Anbindung.

## 🚀 Features

### Kernfunktionen
- **Auftragserfassung** mit automatischer UUID-Generierung
- **Duplikatsprüfung** für Telefonnummern und Adressen
- **Adressvalidierung** mit Google Maps API
- **Rollenbasierte Zugriffskontrolle** (Agent, Monteur, Admin)
- **Echtzeit-Datenübertragung** an n8n-Webhook
- **Mobiloptimiertes Design** für Telegram Web Apps

### Benutzerrollen

#### 🔵 Agent
- Neue Aufträge erstellen
- Aufträge durchsuchen
- Eigene Aufträge anzeigen
- Umsatz melden
- Wartezeit melden

#### 🟢 Monteur
- Zugewiesene Aufträge anzeigen
- Umsatz melden
- Wartezeit melden

#### 🔴 Admin
- Alle Agent- und Monteur-Funktionen
- Aufträge bearbeiten und zuweisen
- Tagesreports generieren
- Alle Aufträge verwalten

## 📋 Formularfelder

### Neuer Auftrag
- **Kundenname** (Pflichtfeld)
- **Adresse** (Pflichtfeld, mit Google Maps Validierung)
- **Telefonnummer** (Pflichtfeld, mit Duplikatsprüfung)
- **Beschreibung** (Pflichtfeld)
- **Branche** (Dropdown): Rohrreinigung, Schlüsseldienst, Schädlingsbekämpfung, Sanitär
- **Priorität** (Dropdown): Dringend, Normal, Niedrig
- **Geschätzter Umsatz** (Optional)
- **Land** (Dropdown): Österreich (AT), Schweiz (CH)

### Umsatzmeldung
- **Auftrag auswählen** (Dropdown)
- **Umsatz in €** (Pflichtfeld)
- **Zahlungsart** (Dropdown): Bar, Überweisung, EC-Karte, Twint
- **Notizen** (Optional)

## 🔧 Installation & Setup

### 1. Dateien bereitstellen
Alle Dateien auf einem Webserver bereitstellen:
- `index.html`
- `styles.css`
- `app.js`

### 2. n8n Webhook konfigurieren
Der Webhook-Endpunkt ist bereits auf die angegebene URL konfiguriert:
```
https://amp-telegram.app.n8n.cloud/webhook/neuer-auftrag
```

### 3. Google Maps API (Optional)
Für die Adressvalidierung Google Maps API Key in `app.js` eintragen:
```javascript
const CONFIG = {
    googleMapsApiKey: 'YOUR_GOOGLE_MAPS_API_KEY_HERE',
    // ...
};
```

### 4. Benutzerrollen konfigurieren
In `app.js` die Benutzer-IDs für Rollen anpassen:
```javascript
function determineUserRole(userId) {
    const adminIds = [12345, 67890]; // Admin User IDs
    const monteurIds = [11111, 22222]; // Monteur User IDs
    
    if (adminIds.includes(userId)) {
        return 'admin';
    } else if (monteurIds.includes(userId)) {
        return 'monteur';
    } else {
        return 'agent';
    }
}
```

### 5. Telegram Bot Setup
1. Bot bei @BotFather erstellen
2. Web App URL setzen
3. Menu Button konfigurieren

## 📡 n8n Webhook-Endpunkte

Die App sendet verschiedene Aktionen an unterschiedliche Endpunkte:

### Hauptendpunkt
```
POST https://amp-telegram.app.n8n.cloud/webhook/neuer-auftrag
```

### Zusätzliche Endpunkte
- `/check-duplicate` - Duplikatsprüfung
- `/stats` - Dashboard-Statistiken
- `/my-orders` - Benutzeraufträge
- `/search` - Auftragssuche
- `/available-orders` - Verfügbare Aufträge für Dropdowns
- `/revenue` - Umsatzmeldung
- `/waiting` - Wartezeitmeldung
- `/daily-report` - Tagesreport
- `/cancel` - Auftrag stornieren
- `/complete` - Auftrag abschließen

## 📊 Datenstruktur

### Neuer Auftrag
```json
{
    "action": "new-order",
    "data": {
        "orderNumber": "AMP-1640995200000-ABC123",
        "customerName": "Max Mustermann",
        "customerAddress": "Musterstraße 1, 1010 Wien",
        "customerPhone": "+43 1 234567890",
        "description": "Rohrverstopfung im Badezimmer",
        "industry": "rohrreinigung",
        "priority": "dringend",
        "estimatedRevenue": 150.00,
        "country": "AT",
        "status": "offen",
        "createdAt": "2023-12-31T23:59:59.999Z",
        "createdBy": 12345,
        "createdByName": "Agent Name"
    },
    "user": {
        "id": 12345,
        "first_name": "Agent",
        "username": "agent_user"
    }
}
```

### Umsatzmeldung
```json
{
    "action": "report-revenue",
    "data": {
        "orderId": "AMP-1640995200000-ABC123",
        "amount": 150.00,
        "paymentMethod": "bar",
        "notes": "Zahlung erhalten",
        "reportedBy": 12345,
        "reportedByName": "Monteur Name",
        "reportedAt": "2023-12-31T23:59:59.999Z"
    }
}
```

## 🎨 Design Features

### Telegram Web App Integration
- Automatische Theme-Erkennung (Hell/Dunkel)
- Native Telegram-Farben
- Responsive Design für alle Bildschirmgrößen
- Touch-optimierte Bedienung

### Accessibility
- Hoher Kontrast-Modus
- Reduzierte Bewegungen (prefers-reduced-motion)
- Tastaturnavigation
- Screenreader-freundlich

### Mobile-First Design
- Grid-basiertes Layout
- Touch-freundliche Buttons (min. 44px)
- Optimierte Formulare
- Schnelle Ladezeiten

## 🔒 Sicherheit

### Validierung
- Client-seitige Formularvalidierung
- Server-seitige Validierung erforderlich
- Duplikatsprüfung
- Adressvalidierung

### Berechtigungen
- Rollenbasierte Zugriffskontrolle
- Telegram-User-ID Verifikation
- Sichere Webhook-Übertragung

## 🚀 Deployment

### Webserver-Anforderungen
- HTTPS erforderlich (für Telegram Web Apps)
- Statische Dateien
- Keine Server-seitige Verarbeitung nötig

### Empfohlene Hosting-Optionen
- GitHub Pages
- Netlify
- Vercel
- Firebase Hosting
- Eigener Webserver mit SSL

## 📱 Telegram Integration

### Bot Commands
```
/start - App starten
/help - Hilfe anzeigen
```

### Menu Button
```json
{
    "text": "Auftragsmanager öffnen",
    "web_app": {
        "url": "https://your-domain.com/index.html"
    }
}
```

## 🔧 Anpassungen

### Branchen erweitern
In `index.html` und `app.js` die Dropdown-Optionen erweitern:
```html
<option value="neue-branche">Neue Branche</option>
```

### Zusätzliche Felder
Neue Formularfelder in `index.html` hinzufügen und in `app.js` die Validierung anpassen.

### Styling anpassen
CSS-Variablen in `styles.css` für Corporate Design anpassen:
```css
:root {
    --primary-color: #YOUR_BRAND_COLOR;
    --secondary-color: #YOUR_SECONDARY_COLOR;
}
```

## 🐛 Troubleshooting

### Häufige Probleme
1. **App lädt nicht**: HTTPS-Zertifikat prüfen
2. **Webhook-Fehler**: n8n-Endpunkt und Netzwerk prüfen
3. **Validierung funktioniert nicht**: Google Maps API Key prüfen
4. **Rollen werden nicht erkannt**: User-IDs in `determineUserRole()` prüfen

### Debug-Modus
Für Tests außerhalb von Telegram:
```javascript
// In app.js - Fallback-Modus wird automatisch aktiviert
console.warn('Telegram Web App not available. Running in fallback mode.');
```

## 📞 Support

Bei Fragen oder Problemen:
1. Console-Logs prüfen (F12 → Console)
2. Netzwerk-Tab prüfen für Webhook-Aufrufe
3. Telegram Web App Dokumentation konsultieren

## 📄 Lizenz

Dieses Projekt steht unter der MIT-Lizenz.

---

**Hinweis**: Diese App ist für den Einsatz als Telegram Mini Web App optimiert und erfordert eine aktive n8n-Integration für die vollständige Funktionalität.