#!/usr/bin/env python3
"""
Modrinth Mod Installer
Downloads mods and their dependencies from Modrinth API
"""

import requests
import json
import os
import argparse
from pathlib import Path
from urllib.parse import urlparse
import sys

class ModrinthInstaller:
    def __init__(self, api_key=None):
        self.base_url = "https://api.modrinth.com/v2"
        self.headers = {"User-Agent": "ModrinthInstaller/1.0"}
        
        # Use provided API key or None (Modrinth API works without auth for most operations)
        if api_key:
            self.headers["Authorization"] = f"Bearer {api_key}"
        
        self.session = requests.Session()
        self.session.headers.update(self.headers)
        
    def get_project_info(self, slug):
        """Get basic project information"""
        try:
            response = self.session.get(f"{self.base_url}/project/{slug}")
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching project info for {slug}: {e}")
            return None
    
    def get_versions(self, slug, loader=None, game_version=None):
        """Get versions for a project with optional filtering"""
        try:
            url = f"{self.base_url}/project/{slug}/version"
            response = self.session.get(url)
            response.raise_for_status()
            versions = response.json()
            
            # Filter versions if criteria provided
            if loader or game_version:
                filtered_versions = []
                for version in versions:
                    loader_match = not loader or loader in version.get('loaders', [])
                    game_match = not game_version or game_version in version.get('game_versions', [])
                    if loader_match and game_match:
                        filtered_versions.append(version)
                return filtered_versions
            
            return versions
        except requests.exceptions.RequestException as e:
            print(f"Error fetching versions for {slug}: {e}")
            return []
    
    def resolve_dependencies(self, version_data, loader, game_version, resolved=None):
        """Recursively resolve all dependencies"""
        if resolved is None:
            resolved = {}
        
        for dep in version_data.get('dependencies', []):
            if dep['dependency_type'] != 'required':
                continue
                
            project_id = dep['project_id']
            if project_id in resolved:
                continue
                
            # Get project info
            project_info = self.get_project_info(project_id)
            if not project_info:
                continue
                
            print(f"  Found dependency: {project_info['title']} ({project_info['slug']})")
            
            # Get compatible version
            dep_versions = self.get_versions(project_info['slug'], loader, game_version)
            if not dep_versions:
                print(f"    Warning: No compatible versions found for {project_info['slug']}")
                continue
                
            # Use specific version if specified, otherwise use latest
            if dep.get('version_id'):
                dep_version = next((v for v in dep_versions if v['id'] == dep['version_id']), None)
                if not dep_version:
                    dep_version = dep_versions[0]  # Fallback to latest
            else:
                dep_version = dep_versions[0]  # Latest version
            
            resolved[project_id] = {
                'project_info': project_info,
                'version_data': dep_version
            }
            
            # Recursively resolve dependencies
            self.resolve_dependencies(dep_version, loader, game_version, resolved)
        
        return resolved
    
    def download_file(self, url, filename, download_dir):
        """Download a file from URL"""
        filepath = Path(download_dir) / filename
        
        try:
            print(f"    Downloading {filename}...")
            response = self.session.get(url, stream=True)
            response.raise_for_status()
            
            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            
            print(f"    ✓ Downloaded to {filepath}")
            return True
        except requests.exceptions.RequestException as e:
            print(f"    ✗ Failed to download {filename}: {e}")
            return False
    
    def install_mod(self, slug, loader="forge", game_version="1.20.1", download_dir="mods"):
        """Install a mod and its dependencies"""
        print(f"Installing mod: {slug}")
        print(f"Target: {loader} {game_version}")
        print(f"Download directory: {download_dir}")
        print("-" * 50)
        
        # Create download directory
        Path(download_dir).mkdir(exist_ok=True)
        
        # Get main mod info
        project_info = self.get_project_info(slug)
        if not project_info:
            print(f"❌ Could not find project: {slug}")
            return False
        
        print(f"📦 {project_info['title']}")
        print(f"   {project_info['description']}")
        
        # Get compatible versions
        versions = self.get_versions(slug, loader, game_version)
        if not versions:
            print(f"❌ No compatible versions found for {loader} {game_version}")
            return False
        
        main_version = versions[0]  # Latest compatible version
        print(f"   Using version: {main_version['version_number']}")
        
        # Resolve dependencies
        print(f"\n🔍 Resolving dependencies...")
        dependencies = self.resolve_dependencies(main_version, loader, game_version)
        
        # Download main mod
        print(f"\n📥 Downloading main mod...")
        main_downloaded = False
        files = main_version.get('files', [])
        
        if not files:
            print(f"    ❌ No files found for {project_info['title']}")
            return False
        
        # Try to find primary file, fallback to first file
        primary_file = None
        for file_info in files:
            if file_info.get('primary', False):
                primary_file = file_info
                break
        
        if not primary_file and files:
            primary_file = files[0]  # Use first file if no primary found
        
        if primary_file:
            filename = primary_file['filename']
            url = primary_file['url']
            if self.download_file(url, filename, download_dir):
                main_downloaded = True
        
        if not main_downloaded:
            print(f"    ❌ Failed to download main mod for {project_info['title']}")
            return False
        
        # Download dependencies
        if dependencies:
            print(f"\n📥 Downloading dependencies...")
            for dep_id, dep_info in dependencies.items():
                project = dep_info['project_info']
                version = dep_info['version_data']
                
                print(f"  {project['title']} v{version['version_number']}")
                
                dep_files = version.get('files', [])
                if not dep_files:
                    print(f"    ❌ No files found for dependency {project['title']}")
                    continue
                
                # Try to find primary file, fallback to first file
                dep_primary_file = None
                for file_info in dep_files:
                    if file_info.get('primary', False):
                        dep_primary_file = file_info
                        break
                
                if not dep_primary_file and dep_files:
                    dep_primary_file = dep_files[0]  # Use first file if no primary found
                
                if dep_primary_file:
                    filename = dep_primary_file['filename']
                    url = dep_primary_file['url']
                    self.download_file(url, filename, download_dir)
        else:
            print(f"\n📥 No dependencies to download")
        
        print(f"\n✅ Installation complete!")
        print(f"   Downloaded to: {os.path.abspath(download_dir)}")
        return True

def main():
    parser = argparse.ArgumentParser(description="Install mods from Modrinth")
    parser.add_argument("slug", help="Mod slug to install")
    parser.add_argument("--loader", default="forge", help="Mod loader (default: forge)")
    parser.add_argument("--game-version", default="1.20.1", help="Minecraft version (default: 1.20.1)")
    parser.add_argument("--download-dir", default="mods", help="Download directory (default: mods)")
    parser.add_argument("--api-key", help="Modrinth API key (optional)")
    
    args = parser.parse_args()
    
    installer = ModrinthInstaller(api_key=args.api_key)
    
    try:
        installer.install_mod(
            slug=args.slug,
            loader=args.loader,
            game_version=args.game_version,
            download_dir=args.download_dir
        )
    except KeyboardInterrupt:
        print(f"\n❌ Installation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
