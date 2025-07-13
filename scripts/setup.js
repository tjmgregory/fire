#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setup() {
  console.log('🚀 Google Apps Script Deployment Setup\n');

  // Check if .clasp.json exists
  const claspJsonPath = path.join(process.cwd(), '.clasp.json');
  const claspJsonExamplePath = path.join(process.cwd(), '.clasp.json.example');
  
  if (!fs.existsSync(claspJsonPath)) {
    console.log('📋 Setting up .clasp.json...');
    
    if (fs.existsSync(claspJsonExamplePath)) {
      const scriptId = await question('Enter your Google Apps Script ID: ');
      
      const claspConfig = {
        scriptId: scriptId.trim(),
        rootDir: './src/apps-script'
      };
      
      fs.writeFileSync(claspJsonPath, JSON.stringify(claspConfig, null, 2));
      console.log('✅ Created .clasp.json\n');
    }
  } else {
    console.log('✅ .clasp.json already exists\n');
  }

  // Check if .env exists
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');
  
  if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    const copyEnv = await question('Would you like to create .env from .env.example? (y/n): ');
    
    if (copyEnv.toLowerCase() === 'y') {
      fs.copyFileSync(envExamplePath, envPath);
      console.log('✅ Created .env file\n');
      console.log('📝 Please edit .env with your configuration values\n');
    }
  }

  // Check clasp authentication
  console.log('🔐 Checking clasp authentication...');
  const clasprcPath = path.join(process.env.HOME || process.env.USERPROFILE, '.clasprc.json');
  
  if (!fs.existsSync(clasprcPath)) {
    console.log('\n⚠️  You need to authenticate with Google');
    const doAuth = await question('Would you like to authenticate now? (y/n): ');
    
    if (doAuth.toLowerCase() === 'y') {
      console.log('\nRunning clasp login...');
      console.log('This will open your browser for authentication.\n');
      
      try {
        execSync('npx clasp login', { stdio: 'inherit' });
        console.log('\n✅ Authentication successful!\n');
      } catch (error) {
        console.error('\n❌ Authentication failed:', error.message);
      }
    } else {
      console.log('\n⚠️  Run "npm run clasp:login" when ready to authenticate');
    }
  } else {
    console.log('✅ Already authenticated with Google\n');
  }

  // Provide next steps
  console.log('📚 Next steps:');
  console.log('1. Edit .env and .clasp.json with your configuration');
  console.log('2. Run "npm run deploy" to push your code to Google Apps Script');
  console.log('3. Run "npm run clasp:open" to open the Apps Script editor\n');

  rl.close();
}

setup().catch(console.error);