{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-23.11"; # or "unstable"
  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.nodejs_20
    pkgs.nodePackages.npm
    pkgs.gnumake
    pkgs.gcc
    pkgs.jdk17
    pkgs.gawk
    (pkgs.google-chrome.override {
      commandLineArgs = "--no-sandbox";
    })
    (
      pkgs.android-studio.override {
      # This fixes a bug where android-studio can't find the JRE
      extraJars = [ pkgs.zulu.jre ];
    })
    pkgs.android-tools
  ];
  # Sets environment variables in the workspace
  env = {
    JAVA_HOME = "${pkgs.jdk17}";
  };

  # IDX-specific configuration
  idx = {
    # Search for the extensions you want on https://open-vsx.org/
    extensions = [
      "dart-code.flutter"
      "dart-code.dart-code"
    ];
    # Tweak editor settings
    workspace = {
      # Runs when a workspace is first created
      onCreate = {
        setup-android = ''
          (yes | sdkmanager --licenses) && \
            sdkmanager "build-tools;34.0.0" "platform-tools" "platforms;android-34" "system-images;android-34;google_apis;x86_64" "emulator" && \
            (yes | avdmanager create avd -n "android" -k "system-images;android-34;google_apis;x86_64" -d "pixel_8_pro")
        '';
      };
      # Runs when a workspace is started
      onStart = {
        android = ''
          echo -e "\033[1;33mWaiting for Android emulator to be ready...\033[0m"
          # Wait for the device connection command to finish
          adb -s emulator-5554 wait-for-device && \
          npm run android
        '';
      };
    };
    # Enable previews and customize configuration
    previews = {
      enable = true;
      previews = {
        web = {
          command = [ "npm" "run" "web" "--" "--port" "$PORT" ];
          manager = "web";
        };
        android = {
          # noop
          command = [ "tail" "-f" "/dev/null" ];
          manager = "web";
        };
      };
    };
  };
}