(function () {
  const PANEL_ID = 'PANEL_PIA_ANNOUNCEMENTS';
  const BASE_URL = "http://127.0.0.1:1947";
  const KOLACHI_LOCAL_URL = BASE_URL + "/api/v1/playAnnouncements";
  const HEALTH_CHECK_URL = BASE_URL + "/health";
  const WAIT_MESSAGE = "Waiting for announcement...";
  const COMPANION_APP_UNDETECTED_MESSAGE = "Companion application not detected.";
  const DURATION_DEFAULT = 3000;
  const ANNOUNCEMENT_FILES = Object.freeze({
    arrival: "PIA-Arrival",
    chime: "chime",
    descent: "PIA-Descent",
    goodbye: "PIA-Goodbye",
    landed: "PIA-Landed",
    landing: "PIA-Landing",
    posttakeoff: "PIA-Post-TO",
    prayer: "PIA-Prayer",
    safety: "PIA-Safety",
    seatbeltsoff: "PIA-Seatbelt-Off",
    seatbeltson: "PIA-Seatbelt-On",
    welcome: "PIA-Welcome"
  });
  const ANNOUNCEMENT_DURATIONS = Object.freeze({
    arrival: 4000,
    chime: 2000,
    descent: 25000,
    goodbye: 61000,
    landed: 38000,
    landing: 32000,
    posttakeoff: 23000,
    prayer: 78000,
    safety: 302000,
    seatbeltsoff: 36000,
    seatbeltson: 31000,
    welcome: 63000
  });

  class KolachiPIAAnnouncementsPanel extends (typeof TemplateElement === 'function' ? TemplateElement : HTMLElement) {
    constructor() {
        super();
    }

    async connectedCallback() {
      if (super.connectedCallback) super.connectedCallback();
      this.renderPanel();
      //this.setStatus('Ready');
    }

    async renderPanel() {
      this.innerHTML = `
        <ingame-ui id="PIAAnnouncementsFrame" panel-id="${PANEL_ID}" icon="coui://html_ui/Icons/Toolbar/ICON_TOOLBAR_PIAANNOUNCEMENTS.png" title="PIA Announcements" class="ingameUiFrame panelInvisible" min-width="420" min-height="560">
          <div class="fs-root">
          <div class="pnl-status" id="fsStatus">Please wait...</div> 
          <div class="fs-kolachi">
                <div class="pnl-title"><span id="fsTitle">Kolachi > Cabin Announcements</span></div>
                <div class="pnl-content" id="fsContent">
                  <div class="txt">Select a cabin announcement by clicking on the buttons below:<br /><br /></div>
                </div>
          </div>
          <div>
              <div class="category preFlight">
                <button class="play-button" id="btnWelcome">Welcome</button>
                <button class="play-button" id="btnPrayer">Prayer</button>
                <button class="play-button" id="btnSafety">Safety</button>
              </div>
              <div class="category duringFlight">
                <button class="play-button" id="btnSeatbeltsOn">Seatbelts On</button>
                <button class="play-button" id="btnSeatbeltsOff">Seatbelts Off</button>
                <button class="play-button" id="btnPostTakeOff">Post Take-Off</button>
              </div>
              <div class="category conclude">
                <button class="play-button" id="btnDescent">Descent</button>
                <button class="play-button" id="btnLanding">Landing</button>
                <button class="play-button" id="btnLanded">Landed</button>
              </div>
              <div>
                <button class="play-button" id="btnArrival">Arrival</button>
                <button class="play-button" id="btnGoodbye">Goodbye</button>
                <button class="play-button" id="btnChime">Chime</button>
              </div>
            </div>
            <div id="fsUrl">
              <div style="margin: 5px 0px;"><hr style="height:1px; border-width:0; color:white; background-color:white;" /></div>
              <div class="url">https://kolachi.tech</div>
            </div>
          </div>
        </ingame-ui>`;

        const buttons = document.querySelectorAll('.play-button');
        buttons.forEach((btn) => {
          var announcementType = btn.id.replace('btn', '').replace(' ', '').toLowerCase();
          btn.addEventListener('click', () => this.playAnnouncement(announcementType));
        });

        if (this.IsConnected()) {
          this.setStatus(WAIT_MESSAGE);
          this.playAnnouncement('chime');
        }
        else {
          this.enableButtons(false);
          this.setStatus(COMPANION_APP_UNDETECTED_MESSAGE, false);
        }
    }

    playAnnouncement(announcementType) {
      const fileName = ANNOUNCEMENT_FILES[announcementType];
      const duration = ANNOUNCEMENT_DURATIONS[announcementType] || DURATION_DEFAULT;

      if (!fileName) {
        this.setStatus(`Unknown announcement: ${announcementType}`, false);
        return;
      }

      return this.playFile(fileName, duration);
    }

    async playFile(fileName, duration) {
      const url = `${KOLACHI_LOCAL_URL}?name=${encodeURIComponent(fileName)}`;

      try {
        this.setStatus(`Playing ${fileName}.mp3`, false);
        this.onAudioStarted();
        const response = await fetch(url, { method: "POST", mode: "cors" }).then(() => this.onAudioFinished(duration));
      } catch (error) {
        this.setStatus(`Playback failed: ${error.message}`, false);
      }
    }

    onAudioStarted() {
      this.enableButtons(false);
    }

    onAudioFinished(duration) {
      setTimeout(() => {
        this.enableButtons(true);
        this.setStatus(WAIT_MESSAGE);
      }, duration+1000); 
    }

    async IsConnected() {
      var isHealthy = false;

      const response = await fetch(HEALTH_CHECK_URL, { cache: "no-store" })
        .then(res => res.json())
        .catch(() => ({ isHealthy: false }));

      isHealthy = response; // || response.status === "ready";
      return isHealthy;
    }

    setStatus(text, hideAfter = true) {
      const msg = this.querySelector('#fsStatus');
      if (!msg) return;
      
      msg.style.display = "block";
      msg.style.opacity = "1";
      msg.textContent = text;

      if (hideAfter) {
        setTimeout(async () => {
          msg.textContent = (this.IsConnected()) ? WAIT_MESSAGE : COMPANION_APP_UNDETECTED_MESSAGE;
        }, DURATION_DEFAULT);
      }
    }

    enableButtons(enable) {
      const buttons = document.querySelectorAll('.play-button');
      buttons.forEach((button) => {
        if (enable) {
          button.classList.remove('disabled');
        }
        else {
          button.classList.add('disabled');
        }
        
        button.disabled = !enable;
      });
    }
  }

  if (!window.customElements.get('kolachi-announcements-panel')) {
    window.customElements.define('kolachi-announcements-panel', KolachiPIAAnnouncementsPanel);
  }

  function mount() {
    if (!document.body.querySelector('kolachi-announcements-panel')) {
      document.body.appendChild(document.createElement('kolachi-announcements-panel'));
    }
    if (typeof checkAutoload === 'function') checkAutoload();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

})();
