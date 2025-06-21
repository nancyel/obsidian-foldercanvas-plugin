import { App, TFile, Notice, TAbstractFile } from "obsidian";
import { normalizeFileName, parseFileName } from "src/utils";
import CanvasNode from "./CanvasNode";
import { FolderCanvasPluginSettings } from "src/main";

function getCanvasFilesInFolder(folderPath: string, basename: string): TFile[] {
	const folder = this.app.vault.getFolderByPath(folderPath);
	if (!folder) return [];

	const files: TFile[] = [];

	const getAllFiles = (file: TAbstractFile) => {
		if (file instanceof TFile) {
			if (file.extension === "canvas" && file.path.includes(basename)) {
				files.push(file);
			}
		} else {
			// @ts-ignore - Accessing children property of TFolder
			file.children?.forEach((child) => getAllFiles(child));
		}
	};

	getAllFiles(folder);
	return files;
}

function generateUniqueFileName(folderPath: string, fileName: string): string {
	const normalizedFileName = normalizeFileName(fileName);
	const components = parseFileName(normalizedFileName);
	const existingFiles = getCanvasFilesInFolder(
		folderPath,
		components.baseName
	);

	// Find the highest number used in existing files with the same base name
	let highestNumber = 0;
	existingFiles.forEach((file: TFile) => {
		const existingComponents = parseFileName(file.name);
		highestNumber = existingComponents.number ?? 1;
	});

	// Generate the next available number
	const newFileName =
		highestNumber === 0
			? normalizedFileName
			: `${components.baseName} ${highestNumber + 1}${components.ext}`;
	return `${folderPath}/${newFileName}`;
}
export async function createCanvasWithNodes(
	app: App,
	folderPath: string,
	files: TFile[],
	canvasFileName: string,
	settings: FolderCanvasPluginSettings
) {
	if (files.length === 0) {
		new Notice("The folder is empty!");
		return;
	}

	const canvasFileNameWithFolder = generateUniqueFileName(
		folderPath,
		canvasFileName
	);

	const canvasData = {
		nodes: await Promise.all(
			files.map(async (file, index) => {
				try {
					const content = await app.vault.read(file);
					const headings = content
						.split("\n")
						.filter((line: string) => line.trim().match(/^#+\s+/))
						.map((line: string) => line.replace(/^#+\s*/, ""));
					const fileSettings = { ...settings };
					if (!headings.includes(settings.selectedHeading)) {
						fileSettings.selectedHeading = "";
					}
					return new CanvasNode(index, file.path, fileSettings);
				} catch (error) {
					console.log(error);
					return null;
				}
			})
		),
		edges: [],
	};
	const canvasFile = await app.vault.create(
		canvasFileNameWithFolder,
		JSON.stringify(canvasData, null, 2)
	);

	if (settings.openOnCreate) {
		await app.workspace.openLinkText(canvasFileNameWithFolder, "", true);
	}

	if (canvasFile) {
		new Notice(`Canvas created at ${canvasFileNameWithFolder}`);
	} else {
		new Notice("Failed to create a Canvas file.");
	}
}
