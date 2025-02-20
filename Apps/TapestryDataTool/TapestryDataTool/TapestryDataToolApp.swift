//
//  TapestryDataToolApp.swift
//  TapestryDataTool
//
//  Created by Craig Hockenberry on 2/20/25.
//

import SwiftUI

@main
struct TapestryDataToolApp: App {
    var body: some Scene {
		Window("Tapestry Data Tool", id: "mainWindow") {
            ContentView()
				.frame(minWidth: 300, maxWidth: 300, minHeight: 200)
        }
		.windowResizability(.contentSize)
		.defaultSize(width: 300, height: 250)
    }
}
