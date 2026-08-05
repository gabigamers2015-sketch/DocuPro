with open('android/app/build.gradle', 'r') as f:
    c = f.read()

signing_config = """    signingConfigs {
        release {
            storeFile file(MYAPP_UPLOAD_STORE_FILE)
            storePassword MYAPP_UPLOAD_STORE_PASSWORD
            keyAlias MYAPP_UPLOAD_KEY_ALIAS
            keyPassword MYAPP_UPLOAD_KEY_PASSWORD
        }
    }
    buildTypes {"""

c = c.replace("    buildTypes {", signing_config, 1)
c = c.replace("signingConfig signingConfigs.debug", "signingConfig signingConfigs.release")

with open('android/app/build.gradle', 'w') as f:
    f.write(c)
print("signing configurado")
