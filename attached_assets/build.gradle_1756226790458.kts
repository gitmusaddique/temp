plugins {
    id("org.jetbrains.kotlin.jvm") version "2.1.21"
    id("org.jetbrains.compose") version "1.8.2"
    id("org.jetbrains.kotlin.plugin.compose") version "2.2.0"
}

repositories {
    google()
    mavenCentral()
}

dependencies {
    implementation(compose.desktop.currentOs)
    implementation("org.jetbrains.compose.material:material-icons-core:1.7.3")
    implementation("org.jetbrains.compose.material:material-icons-extended:1.7.3")
    implementation("org.jetbrains.compose.material3:material3:1.8.2")
    implementation("org.jetbrains.androidx.navigation:navigation-compose:2.9.0-beta04")
    implementation("org.jetbrains.kotlin:kotlin-bom:2.2.0")
    
    // SQLite Database
    implementation("org.xerial:sqlite-jdbc:3.44.1.0")
    
    // Excel Export
    implementation("org.apache.poi:poi:5.2.4")
    implementation("org.apache.poi:poi-ooxml:5.2.4")
    implementation("org.apache.poi:poi-scratchpad:5.2.4")
    
    // PDF Export
    implementation("com.itextpdf:itextpdf:5.5.13.3")
}

compose.desktop {
    application {
        mainClass = "MainKt"
    }
}

kotlin {
    sourceSets.main {
        kotlin.srcDir(".")
    }
}

tasks.named("compileKotlin") {
    dependsOn("processResources", "assembleMainResources")
}

