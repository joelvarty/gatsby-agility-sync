const agilityConfig = require('./agility-config')
const agilityAPI = require('@agility/content-fetch')
const localAgilityAccess = require('./local-agility-access')

const { logDebug, logInfo, logError, logWarning, logSuccess, asyncForEach } = require('./util')

const getAgilityAPIClient = () => {

	return agilityAPI.getApi({
		guid: agilityConfig.guid,
		apiKey: agilityConfig.apiKey,
		isPreview: agilityConfig.isPreview,
		debug: agilityConfig.debug
	})
}

/**
 * Sync the content items in the specified Agility Instance.
 */
const syncContent = async (agilityClient, languageCode, token) => {

	if (!token) token = 0;

	do {

		//sync content items...
		logInfo(`Pulling Content Changes - ${token}`);


		const syncRet = await agilityClient.getSyncContent({
			syncToken: token,
			pageSize: 100,
			languageCode: languageCode,

		});

		const syncItems = syncRet.items;

		//if we don't get anything back, kick out
		if (syncItems.length === 0) {
			logInfo(`Content Sync returned no item(s).`);
			break;
		}

		for (let index = 0; index < syncItems.length; index++) {
			await localAgilityAccess.saveContentItem({ contentItem: syncItems[index], languageCode });
		}

		token = syncRet.syncToken;
		logInfo(`Content Sync returned ${syncItems.length} item(s).`);

	} while (token > 0)

	return token;
}
const syncPages = async (agilityClient, languageCode, token) => {
	if (!token) token = 0;

	do {
		//sync pages...
		logInfo(`Pulling Page Changes - ${token}`);

		const syncRet = await agilityClient.getSyncPages({
			syncToken: token,
			pageSize: 100,
			languageCode: languageCode
		});

		const syncItems = syncRet.items;

		//if we don't get anything back, kick out
		if (syncItems.length === 0) {
			logInfo(`Page Sync returned no item(s).`);
			break;
		}

		for (let index = 0; index < syncItems.length; index++) {
			await localAgilityAccess.savePageItem({ pageItem: syncItems[index], languageCode });
		}

		token = syncRet.syncToken;
		logInfo(`Page Sync returned ${syncItems.length} item(s).`);

	} while (token > 0)


	return token;
}

const runSync = async (storageAccess) => {

	let agilityClient = getAgilityAPIClient();

	if (storageAccess) localAgilityAccess.setLocalStorageAccess(storageAccess);

	const languageCodes = agilityConfig.languageCodes.split(',');
	for (const languageCode of languageCodes) {

		logSuccess(`Starting Sync for ${languageCode}`);
		let syncState = await localAgilityAccess.getSyncState({ languageCode });

		if (!syncState) syncState = { itemToken: 0, pageToken: 0 };

		const newItemToken = await syncContent(agilityClient, languageCode, syncState.itemToken);
		const newPageToken = await syncPages(agilityClient, languageCode, syncState.pageToken);

		if (newItemToken != syncState.itemToken
			|| newPageToken != syncState.pageToken) {
			//if we sync ANYTHING - pull the new sitemap down
			const channels = agilityConfig.channels.split(',');

			for (const channelName of channels) {
				const sitemap = await agilityClient.getSitemapFlat({ channelName, languageCode });
				localAgilityAccess.saveSitemap({ sitemap, languageCode, channelName });
			}

			logInfo(`Updated Sitemap channels: ${agilityConfig.channels}`);
		}

		syncState.itemToken = newItemToken;
		syncState.pageToken = newPageToken;

		await localAgilityAccess.saveSyncState({ syncState, languageCode });

		logSuccess(`Completed Sync for ${languageCode}`);

	}

}

const clearSync = async () => {
	await localAgilityAccess.clear();
	logSuccess(`Cleared Sync Items`);
}


if (process.argv[2]) {
	if (process.argv[2] === "clear") {
		//clear everything
		return clearSync();
	} else if (process.argv[2] === "sync") {
		//run the sync
		return runSync()

	}
}

module.exports = {
	clearSync: clearSync,
	runSync: runSync,
	storageAccess: null
}