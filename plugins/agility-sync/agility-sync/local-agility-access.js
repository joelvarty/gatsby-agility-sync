const agilityConfig = require('./agility-config')
const { logDebug, logInfo, logError, logWarning, logSuccess, asyncForEach } = require('./util')

let localStorageAccess = require('./sync-storage-files');


const validateLocalStorageAccess = () => {
	if (!localStorageAccess.clearItems
		|| !localStorageAccess.getItem
		|| !localStorageAccess.saveItem) {
		logError("The local storage access provider specified does not implement the clearItems, getItem, or saveItem method.");
		return false;
	}
	return true;
}

const setLocalStorageAccess = (newLocalStorageAccess) => {
	localStorageAccess = newLocalStorageAccess;
	return validateLocalStorageAccess();
}

const saveContentItem = async ({ contentItem, languageCode }) => {


	if (!contentItem || !contentItem.properties) {
		logWarning('Null item or item with no properties cannot be saved');
		return;
	}

	let referenceName = contentItem.properties.referenceName;
	let definitionName = contentItem.properties.definitionName;


	if (contentItem.properties.state === 3) {
		//if the item is deleted

		//grab the reference name from the currently saved item...
		const currentItem = await localStorageAccess.getItem({ itemType: "item", languageCode, itemID: contentItem.contentID });
		if (currentItem) {

			referenceName = currentItem.properties.referenceName;
			definitionName = currentItem.properties.definitionName;

			await localStorageAccess.deleteItem({ itemType: "item", languageCode, itemID: contentItem.contentID });
		}


	} else {
		//regular item
		await localStorageAccess.saveItem({ item: contentItem, itemType: "item", languageCode, itemID: contentItem.contentID });
	}

	if (referenceName) {
		//save the item by reference name - it might need to be merged into a list
		await localStorageAccess.mergeItemToList({ item: contentItem, languageCode, itemID: contentItem.contentID, referenceName, definitionName });
	}
}

const savePageItem = async ({ pageItem, languageCode }) => {

	if (pageItem.properties.state === 3) {
		//item is deleted
		await localStorageAccess.deleteItem({ itemType: "page", languageCode, itemID: pageItem.pageID });
	} else {
		//regular item
		await localStorageAccess.saveItem({ item: pageItem, itemType: "page", languageCode, itemID: pageItem.pageID });
	}
}

const saveSitemap = async ({ sitemap, channelName, languageCode }) => {
	await localStorageAccess.saveItem({ item: sitemap, itemType: "sitemap", languageCode, itemID: channelName });

}

const saveSyncState = async ({ syncState, languageCode }) => {
	await localStorageAccess.saveItem({ item: syncState, itemType: "state", languageCode, itemID: "sync" });

}

const getSyncState = async ({ languageCode }) => {
	return await localStorageAccess.getItem({ itemType: "state", languageCode, itemID: "sync" });
}

const getContentItem = async ({ contentID, languageCode, depth = 2 }) => {

	const contentItem = await localStorageAccess.getItem({ itemType: "item", languageCode, itemID: contentID });
	return await expandContentItem({ contentItem, languageCode, depth });
}

const expandContentItem = async ({ contentItem, languageCode, depth }) => {
	if (depth > 0) {

		//make this work for the .fields or the .customFields property...
		let fields = contentItem.fields;
		if (!fields) fields = contentItem.customFields;


		for (const fieldName in fields) {
			const fieldValue = fields[fieldName];

			if (fieldValue.contentid > 0) {
				//single linked item
				const childItem = await getContentItem({ contentID: fieldValue.contentid, languageCode, depth: depth - 1 });
				if (childItem != null) fields[fieldName] = childItem;
			} else if (fieldValue.sortids && fieldValue.sortids.split) {
				//multi linked item
				const sortIDAry = fieldValue.sortids.split(',');
				const childItems = [];
				for (const childItemID of sortIDAry) {
					const childItem = await getContentItem({ contentID: childItemID, languageCode, depth: depth - 1 });
					if (childItem != null) childItems.push(childItem);
				}

				fields[fieldName] = childItems;

			}
		}

	}

	return contentItem;
}

const getContentList = async ({ referenceName, languageCode }) => {
	return await localStorageAccess.getItem({ itemType: "list", languageCode, itemID: referenceName });
}
/**
 * Get a Page based on it's id and languageCode.
 * @param {*} { pageID, languageCode, depth = 3 }
 * @returns
 */
const getPageItem = async ({ pageID, languageCode, depth = 3 }) => {

	let pageItem = await localStorageAccess.getItem({ itemType: "page", languageCode, itemID: pageID });

	if (depth > 0) {
		//if a depth was specified, pull in the modules (content items) for this page
		for (const zoneName in pageItem.zones) {
			const zone = pageItem.zones[zoneName];

			for (const mod of zone) {
				const moduleItem = await getContentItem({ contentID: mod.item.contentid, languageCode, depth: depth - 1 });
				mod.item = moduleItem;
			}
		}


	}

	return pageItem;

}

const getSitemap = async ({ channelName, languageCode }) => {
	return await localStorageAccess.getItem({ itemType: "sitemap", languageCode, itemID: channelName });
}
/**
 * Clear everything out.
 */
const clear = async () => {
	await localStorageAccess.clearItems();
}


module.exports = {
	saveContentItem: saveContentItem,
	savePageItem: savePageItem,
	getContentItem: getContentItem,
	getContentList: getContentList,
	getPageItem: getPageItem,
	getSitemap: getSitemap,
	saveSitemap: saveSitemap,
	getSyncState: getSyncState,
	saveSyncState: saveSyncState,
	clear: clear,
	setLocalStorageAccess: setLocalStorageAccess
}

