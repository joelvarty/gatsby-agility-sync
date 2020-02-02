let agility = require('./content-fetch')

const localAgilityAccess = require('./agility-sync/local-agility-access')
let agilitySync = require("./agility-sync/sync-content")
let agilityConfig = require("./agility-sync/agility-config")

let path = require('path')
let { logDebug, logInfo, logError, logWarning, logSuccess, asyncForEach } = require('./plugin-util')

let { GatsbyStorageAccess } = require("./gatsby-storage-access")

exports.sourceNodes = async (args, configOptions) => {
	const { actions, createNodeId, createContentDigest, getNode, getNodes, store, cache, reporter } = args;
	const { createNode, deleteNode, deletePage, touchNode } = actions


	const storageAccess = new GatsbyStorageAccess({ getNode, createNodeId, createNode, createContentDigest, deleteNode });


	logInfo(`Source Nodes Started (${process.env.NODE_ENV})...`);


	/**
	 * Touch the previous nodes so that they don't get erased in this build
	 */
	const touchAllNodes = async () => {

		let nodes = getNodes();

		let count = 0;
		await asyncForEach(nodes, async (node) => {
			//only touch the Agility nodes that are NOT sitemap nodes
			const nodeType = node.internal.type.toLowerCase();
			if (nodeType.indexOf("agility") != -1
				&& nodeType.indexOf("agilitySitemapNode") === -1) {
				await touchNode({ nodeId: node.id });
				count++;
			}
		});

		logSuccess(`Touched ${count} nodes`);

	}



	await touchAllNodes();
	await agilitySync.runSync(storageAccess);


	logInfo(`Creating sitemap nodes.`);
	//TODO: determine the starting language properly...
	let languageCode = "en-us";
	let sitemap = await localAgilityAccess.getSitemap({ channelName: "website", languageCode });

	//create the sitemap nodes...
	for (const pagePath in sitemap) {

		const sitemapNode = sitemap[pagePath];

		const nodeID = createNodeId(`sitemap-${sitemapNode.pageID}-${sitemapNode.contentID}`);

		const nodeMeta = {
			id: nodeID,
			parent: null,
			children: [],
			languageCode: languageCode,
			pagePath: pagePath,
			internal: {
				type: "agilitySitemapNode",
				content: "",
				contentDigest: createContentDigest(sitemapNode)
			}
		}

		const nodeToCreate = Object.assign({}, sitemapNode, nodeMeta);

		await createNode(nodeToCreate);

	}

	logInfo(`Source Nodes Completed.`);

}

exports.createPages = async (args, configOptions) => {


	const { graphql, actions, getNode, createNodeId, createContentDigest, store } = args;
	const { createPage, deletePage, createNode, createRedirect, createPageDependency } = actions;

	logInfo(`Create Pages Started...`);

	let isPreview = configOptions.isPreview;
	let pageTemplate = null;
	if (configOptions.defaultPageTemplate) {
		pageTemplate = path.resolve(configOptions.defaultPageTemplate);
	}

	// const storageAccess = new GatsbyStorageAccess({ getNode, createNodeId, createNode, createContentDigest });
	// localAgilityAccess.setLocalStorageAccess(storageAccess);

	//TODO: determine the starting language properly...
	let languageCode = "en-us";
	let sitemap = await localAgilityAccess.getSitemap({ channelName: "website", languageCode });
	if (sitemap == null) {
		logWarning(`Could not get the sitemap node(s)`)
		return;
	}


	/**
	 * Create a page for Gatsby to render based on a sitemap node
	 * @param {*} pagePath
	 * @param {*} sitemapNode
	 * @param {*} isHomePage
	 * @returns
	 */
	const createAgilityPage = async (pagePath, sitemapNode, isHomePage) => {

		if (sitemapNode.isFolder) return;

		if (isHomePage) {

			//create a redirect from sitemapNode.path to /
			await createRedirect({
				fromPath: sitemapNode.path,
				toPath: "/",
				isPermantent: true,
				redirectInBrowser: true
			});

			pagePath = "/";
		}



		let createPageArgs = {
			path: pagePath,
			component: pageTemplate,
			context: {
				pageID: sitemapNode.pageID,
				contentID: sitemapNode.contentID || -1,
				languageCode: languageCode,
				title: sitemapNode.title,
				isPreview: isPreview
			}
		}

		createPage(createPageArgs);

		if (configOptions.debug) {
			logDebug(JSON.stringify(createPageArgs));
		}


	}


	let isHomePage = true;

	//loop all nodes we returned...
	for (const pagePath in sitemap) {
		const sitemapNode = sitemap[pagePath];
		await createAgilityPage(pagePath, sitemapNode, isHomePage);
		isHomePage = false;
	}
}

exports.createResolvers = (args) => {

	const { createResolvers, getNode, createNodeId, createNode, createContentDigest } = args;

	// const storageAccess = new GatsbyStorageAccess({ getNode, createNodeId, createNode, createContentDigest });
	// localAgilityAccess.setLocalStorageAccess(storageAccess);

	const getContentItem = async ({ contentID, languageCode, context, depth }) => {

		const preStr = `agility${languageCode}-item-${contentID}`.toLowerCase();
		const nodeIDStr = createNodeId(preStr);

		const gItem = context.nodeModel.getNodeById({
			id: nodeIDStr,
			type: "agilityitem",
		});

		if (!gItem) return null;

		const itemJson = gItem.internal.content;
		const contentItem = JSON.parse(itemJson);

		//expand the item if we have to...
		if (depth > 0) {

			for (const fieldName in contentItem.fields) {
				const fieldValue = contentItem.fields[fieldName];

				if (fieldValue.contentid > 0) {
					//single linked item
					const childItem = await getContentItem({ contentID: fieldValue.contentid, languageCode, context, depth: depth - 1 });
					if (childItem != null) contentItem.fields[fieldName] = childItem;
				} else if (fieldValue.sortids && fieldValue.sortids.split) {
					//multi linked item
					const sortIDAry = fieldValue.sortids.split(',');
					const childItems = [];
					for (const childItemID of sortIDAry) {
						const childItem = await getContentItem({ contentID: childItemID, languageCode, context, depth: depth - 1 });
						if (childItem != null) childItems.push(childItem);
					}

					contentItem.fields[fieldName] = childItems;

				}
			}

		}

		return contentItem;

	}

	const resolvers = {

		agilitypage: {

			pageJson: {
				resolve: async (source, args, context, info) => {

					const languageCode = source.languageCode;
					const pageID = source.itemID;

					const pageJSON = source.internal.content;
					const pageItem = JSON.parse(pageJSON);
					let depth = 3;

					for (const zoneName in pageItem.zones) {
						const zone = pageItem.zones[zoneName];

						for (const mod of zone) {
							const moduleItem = await getContentItem({ contentID: mod.item.contentid, languageCode, context, depth: depth - 1 });
							mod.item = moduleItem;
						}
					}

					return JSON.stringify(pageItem);

				}
			}
		},
		agilityitem: {
			itemJson: {
				resolve: async (source, args, context, info) => {
					const languageCode = source.languageCode;
					const contentID = source.itemID;

					const itemExpanded = await getContentItem({ contentID, languageCode, context, depth: 3 });

					return JSON.stringify(itemExpanded);
				}
			}
		}
	}
	createResolvers(resolvers)
}