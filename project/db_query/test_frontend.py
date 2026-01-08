#!/usr/bin/env python3
"""Frontend test using Playwright."""

from playwright.sync_api import sync_playwright
import time

def test_frontend():
    """Test the frontend application with Playwright."""
    print("=== Starting Frontend Test ===\n")

    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=False, slow_mo=1000)
        page = browser.new_page()

        # Navigate to frontend
        print("1. Opening http://localhost:5173")
        page.goto("http://localhost:5173")
        time.sleep(2)

        # Take screenshot
        page.screenshot(path="screenshot_1_dashboard.png")
        print("   [Screenshot saved: screenshot_1_dashboard.png]")

        # Check page title
        title = page.title()
        print(f"   Page title: {title}\n")

        # Try to find the "Add Database" button
        print("2. Looking for Add Database button...")
        try:
            # Look for any button that might add a database
            buttons = page.locator("button").all()
            print(f"   Found {len(buttons)} buttons on page")
            for i, btn in enumerate(buttons[:5]):
                text = btn.inner_text()
                print(f"   Button {i}: '{text}'")
        except Exception as e:
            print(f"   Error: {e}\n")

        # Try to find database list
        print("3. Checking for database list...")
        try:
            # Check if there's an empty state or database list
            list_elements = page.locator("ul, ol, .ant-list").all()
            print(f"   Found {len(list_elements)} list elements")
        except Exception as e:
            print(f"   Error: {e}\n")

        # Try to create a database via API first, then check if it appears
        print("4. Creating test database via API...")
        import requests
        try:
            create_data = {
                "name": "frontend-test-db",
                "url": "sqlite:////Users/liufukang/workplace/AI/project/db_query/temp_data/frontend_test.db"
            }
            response = requests.put(
                "http://localhost:8000/api/v1/dbs/frontend-test-db",
                json=create_data
            )
            if response.status_code == 201:
                print("   Database created successfully!")
            else:
                print(f"   Failed to create database: {response.status_code}")
        except Exception as e:
            print(f"   Error creating database: {e}\n")

        # Refresh the page
        print("5. Refreshing the page...")
        page.reload()
        time.sleep(2)
        page.screenshot(path="screenshot_2_with_database.png")
        print("   [Screenshot saved: screenshot_2_with_database.png]")

        # Try to click on the database
        print("6. Looking for database card/link...")
        try:
            # Look for any element containing the database name
            db_elements = page.locator("text=frontend-test-db").all()
            print(f"   Found {len(db_elements)} elements with 'frontend-test-db'")

            if db_elements:
                # Try to click the first one
                db_elements[0].click()
                time.sleep(2)
                print("   Clicked on database!")
                page.screenshot(path="screenshot_3_database_detail.png")
                print("   [Screenshot saved: screenshot_3_database_detail.png]")

                # Check for SQL editor
                print("7. Looking for SQL editor...")
                try:
                    textarea = page.locator("textarea, .monaco-editor").all()
                    print(f"   Found {len(textarea)} editor elements")
                except Exception as e:
                    print(f"   Error: {e}")

        except Exception as e:
            print(f"   Error: {e}\n")

        # Wait a bit and take final screenshot
        time.sleep(2)
        page.screenshot(path="screenshot_4_final.png")
        print("   [Screenshot saved: screenshot_4_final.png]")

        # Close browser
        print("\n8. Closing browser...")
        browser.close()

    print("\n=== Frontend Test Completed ===")
    print("\nScreenshots saved:")
    print("  - screenshot_1_dashboard.png")
    print("  - screenshot_2_with_database.png")
    print("  - screenshot_3_database_detail.png")
    print("  - screenshot_4_final.png")

if __name__ == "__main__":
    test_frontend()
