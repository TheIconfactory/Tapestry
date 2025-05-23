//
//  ContentView.swift
//  TapestryDataTool
//
//  Created by Craig Hockenberry on 2/20/25.
//

import SwiftUI

struct ContentView: View {
	@State private var presentDataImport = false
	@State private var isImportingData = false
	@State private var jsonObject: Any?

	@State private var presentOPMLExport = false
	@State private var outputData: String?
	
	@State private var confirmationTitle = ""
	@State private var confirmationMessage = ""
	@State private var presentConfirmation = false

	var body: some View {
		VStack(alignment: .center) {
			Text("Select the JSON file that contains a Tapestry Backup")
				.multilineTextAlignment(.center)
				.font(.headline)
			Button {
				presentDataImport = true
			} label: {
				Text("Open Tapestry Backup")
					.frame(maxWidth: .infinity)
			}
			.padding(.bottom, 20)
			
			Text("Create an OPML file for the XML and JSON feeds")
				.multilineTextAlignment(.center)
				.font(.headline)
			Button {
				if let jsonObject {
					presentOPMLExport = true
					outputData = OPMLGenerator.generate(from: jsonObject)
				}
			} label: {
				Text("Save OPML File")
					.frame(maxWidth: .infinity)
			}
			.disabled(jsonObject == nil)

			Text("Note that other feeds, such as Mastodon or Bluesky accounts, are not exported.")
				.multilineTextAlignment(.center)
				.foregroundStyle(.secondary)
				.font(.subheadline)
		}
		.fileImporter(isPresented: $presentDataImport, allowedContentTypes: [.json]) { result in
			Task<Void, Never> {
				isImportingData = true
				defer { isImportingData = false }
				do {
					let url = try result.get()
					
					let accessing = url.startAccessingSecurityScopedResource()
					defer {
						if accessing {
							url.stopAccessingSecurityScopedResource()
						}
					}
					
					let data = try Data(contentsOf: url)
					jsonObject = try? JSONSerialization.jsonObject(with: data)
					print("JSON => \(jsonObject.debugDescription)")
				} catch {
					confirmationTitle = "Open Failed"
					confirmationMessage = "Error was '\(error.localizedDescription)'"
					presentConfirmation = true
				}
			}
		}
		.fileExporter(isPresented: $presentOPMLExport, item: outputData, defaultFilename: "Tapestry.opml") { results in
			outputData = nil
			if case .failure(let error) = results {
				confirmationTitle = "Save Failed"
				confirmationMessage = "Error was '\(error.localizedDescription)'"
				presentConfirmation = true
			}
		}
		.alert(confirmationTitle, isPresented: $presentConfirmation) {
			Button("OK", role: .cancel) { }
		} message: {
			Text(confirmationMessage)
		}
		
		.padding()
	}
}

#Preview {
	ContentView()
		.frame(minWidth: 300, maxWidth: 300, minHeight: 200)
}
