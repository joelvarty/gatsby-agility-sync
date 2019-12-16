var { logDebug, logInfo, logError, logWarning, logSuccess, asyncForEach } = require('./plugin-util')


class ContentResolver {

	constructor({ getNode, createNodeId, createNode, createContentDigest, deleteNode }) {
		this.getNode = getNode;
		this.createNode = createNode;
		this.createNodeId = createNodeId;
		this.deleteNode = deleteNode;
		this.createContentDigest = createContentDigest;
		this.contentByID = {};
		this.contentByRefName = {};
		this.sitemapNodes = {};
	}


	async expandPage({ page, existingPageNode }) {


		const languageCode = page.languageCode;
		const pagePath = page.path;
		const pageID = page.pageID;

		//if we have an existing page, copy over the resolved zones from it...
		if (existingPageNode && existingPageNode.internal && existingPageNode.internal.content) {
			const pJSON = existingPageNode.internal.content;
			const existingPage = JSON.parse(pJSON);

			for (const zoneName in existingPage.zones) {
				const existingZone = existingPage.zones[zoneName];
				const newZone = page.zones[zoneName];

				if (existingZone != null) {

					const replacedZones = [];

					newZone.forEach((newModule) => {
						const existingModule = existingZone.find((m) => {
							return m.item.contentID === newModule.item.contentID || m.item.contentID === newModule.item.contentid
						});

						if (existingModule) {
							replacedZones.push(existingModule);
						} else {
							replacedZones.push(newModule);
						}
					});

					page.zones[zoneName] = replacedZones;

				}
			}
		}


		let newZones = {};

		for (const zoneName in page.zones) {
			if (page.zones.hasOwnProperty(zoneName)) {
				const zone = page.zones[zoneName];
				let newZone = [];
				await asyncForEach(zone, async (module) => {

					let contentID = module.item.contentID;
					if (!contentID) contentID = module.item.contentid;

					const contentItem = await this.expandContentByID({ contentID, languageCode, pageID, depth: 0 });
					if (contentItem != null) {
						//add this module's content item into the zone
						module.item = contentItem;
					}
					//newZone.push(module);

				});
				//newZones[zoneName] = newZone;
			}
		}

		// await asyncForEach(page.zones, async (zone) => {
		// 	let newZone = [];
		// 	await asyncForEach(zone.modules, async (module) => {
		// 		const contentItem = await expandContentByID({ contentID: module.item.contentid, languageCode: languageCode, path: pagePath, depth: 0 });
		// 		if (contentItem != null) {
		// 			//add this module's content item into the zone
		// 			newZone.push(contentItem);
		// 		}

		// 	});
		// 	newZones[zone.name] = newZone;
		// });

		//page.zones = newZones;

		//grab the dynamic item if we can


		return page;

	}


	addContentByID({ content }) {

		const languageCode = content.languageCode;
		const contentID = content.contentID;

		if (!this.contentByID[languageCode]) {
			this.contentByID[languageCode] = {}
		}

		this.contentByID[languageCode][contentID] = content;

	}

	addContentByRefName({ content }) {
		const refName = content.properties.referenceName;
		const languageCode = content.languageCode;

		if (!this.contentByRefName[languageCode]) {
			this.contentByRefName[languageCode] = {}
			this.contentByRefName[languageCode][refName] = content;
		}
	}

	getNewlySyncedConent() {
		return this.contentByID;
	}

	addSitemapNode({ node, languageCode }) {

		if (!this.sitemapNodes[languageCode]) this.sitemapNodes[languageCode] = {};

		let contentID = node.contentID;
		if (!contentID) contentID = -1;

		const key = `${node.pageID}-${contentID}`

		this.sitemapNodes[languageCode][key] = node;
	}

	getSitemapNode({ pageID, languageCode, contentID }) {

		if (!contentID) contentID = -1;

		const key = `${pageID}-${contentID}`

		if (!this.sitemapNodes[languageCode]) return null;
		return this.sitemapNodes[languageCode][key];

	}

	/**
	   * Expands linked content given a page id.
	   * @param {*} { contentID, languageCode, pageID, depth }
	   * @returns
	   */
	async expandContentByID({ contentID, languageCode, pageID, depth, maxDepth }) {

		if (!this.contentByID[languageCode]) return null;

		let item = this.contentByID[languageCode][contentID];
		if (item == null) {
			//if the item wasn't available in our cache, fall back on the GraphQL...
			item = await this.queryContentItem({ contentID, languageCode });

			if (item == null) return null;

			//since we pulled this from graphql, don't traverse it any deeper
			maxDepth = 0;
		}



		if (!maxDepth) maxDepth = 3;

		//convert the object to JSON and back to avoid circular references...
		const json = JSON.stringify(item);
		item = JSON.parse(json);



		//track the dependency for this node...
		await this.addAgilityPageDependency({ pageID, contentID: contentID, languageCode: languageCode });

		return await this.expandContent({ contentItem: item, languageCode, pageID, depth, maxDepth });

	}

	/**
	 * Expand any linked content based on the json.
	 * @param {*} { item, languageCode, pageID, depth }
	 * @returns The expanded content item.
	 */
	async expandContent({ contentItem, languageCode, pageID, depth, maxDepth }) {

		if (!maxDepth) maxDepth = 3;

		//only traverse as deep as we are supposed to...
		if (depth < maxDepth) {

			const agilityFields = contentItem.agilityFields;
			const newDepth = depth + 1;

			//*** loop all the fields */
			for (const fieldName in agilityFields) {
				if (agilityFields.hasOwnProperty(fieldName)) {
					let fieldValue = agilityFields[fieldName];

					//*** pull in the linked content by id */
					if ((fieldValue.contentID && parseInt(fieldValue.contentID) > 0)
						|| (fieldValue.contentid && parseInt(fieldValue.contentid) > 0)) {
						let linkedContentID = parseInt(fieldValue.contentID);
						if (isNaN(linkedContentID)) linkedContentID = parseInt(fieldValue.contentid);

						//expand this content item...
						const linkedContentItem = await this.expandContentByID({ contentID: linkedContentID, languageCode, pageID, depth: newDepth, maxDepth: 1 })
						if (linkedContentItem != null) {
							//attach it to the field value..
							fieldValue.item = linkedContentItem;
						}

					}

					//*** pull in the linked content by multiple ids */
					else if (fieldValue.sortids && fieldValue.sortids.split) {
						//pull in the linked content by multiple ids

						const linkedContentItems = [];
						const linkedContentIDs = fieldValue.sortids.split(',');

						for (const i in linkedContentIDs) {
							const linkedContentID = parseInt(linkedContentIDs[i]);
							if (linkedContentID > 0) {
								//expand this content item...
								const linkedContentItem = await this.expandContentByID({ contentID: linkedContentID, languageCode, pageID, depth: newDepth, maxDepth: 1 })
								if (linkedContentItem != null) {
									//add it to the array
									linkedContentItems.push(linkedContentItem);
								}
							}
						}

						//attach these items to the field value
						fieldValue.items = linkedContentItems;
					}

					//*** pull in the linked content by reference name */
					else if (fieldValue.referencename) {

						const lst = await this.getContentItemsByRefName({ refName: fieldValue.referencename, languageCode });

						if (lst != null) {
							await asyncForEach(lst, async (listItem) => {

								const json = JSON.stringify(listItem);
								const thisItem = JSON.parse(json);

								//track the dependency for this node...
								await addAgilityPageDependency({ pageID, contentID: thisItem.contentID, languageCode: languageCode });

								let linkedContentItem = await expandContent({ contentItem: thisItem, languageCode, pageID, depth: newDepth, maxDepth: 1 });
								if (linkedContentItem != null) {
									lst.push(linkedContentItem);
								}

							});
						}

						fieldValue.items = lst;

					}

				}

			}
		}


		return contentItem;
	}

	async getDependantPageIDs({ contentID, languageCode }) {
		const depNodeID = this.createNodeId(`agility-dep-${contentID}-${languageCode}`);
		let depNode = await this.getNode(depNodeID);
		if (depNode != null) {
			return depNode.pageIDs;
		}

		return [];
	}



	/**
	 * Add a dependancy for this content item onto the current page.
	 * @param {*} { pageID, contentID, languageCode }
	 * @memberof ContentResolver
	 */
	async addAgilityPageDependency({ pageID, contentID, languageCode }) {


		//TODO: track the dependency for the parent content item as well

		if (pageID < 1) return;

		//track the dependency in GraphQL
		const depNodeID = this.createNodeId(`agility-dep-${contentID}-${languageCode}`);
		let depNode = await this.getNode(depNodeID);

		let pageIDs = [pageID];

		if (depNode != null) {
			if (depNode.pageIDs.indexOf(pageID) != -1) {
				//we already have a dependancy here, kick out
				return;
			}
			depNode.pageIDs.push(pageID)
			pageIDs = depNode.pageIDs;
		}

		const obj = {
			contentID: contentID,
			languageCode: languageCode,
			pageIDs: pageIDs
		};

		const nodeMeta = {
			id: depNodeID,
			parent: null,
			children: [],
			internal: {
				type: `AgilityPageDependency`,
				content: "",
				contentDigest: this.createContentDigest(obj)
			}
		}
		depNode = Object.assign({}, obj, nodeMeta);

		await this.createNode(depNode);

	}

	async removeAgilityDependency({ contentID, languageCode }) {
		const depNodeID = this.createNodeId(`agility-dep-${contentID}-${languageCode}`);

		await this.deleteNode({
			node: this.getNode(depNodeID),
		});
	}

	getContentItemsByRefName({ refName, languageCode }) {
		if (!this.contentByRefName[languageCode]) return null;

		return this.contentByRefName[languageCode][refName];
	}

	/*
	async queryContentList({ referenceName, languageCode }) {



		const result = await graphql(`
		  query ContentItemQuery {

		    allAgilityContent(
		      filter: {properties: {referenceName: {eq: "${referenceName}"}}, languageCode: {eq: "${languageCode}"}}) {
		      nodes {
		        id
		        internal {
		          content
		        }
		      }
		    }
		  }`);

		if (result.errors) {
			throw result.errors
		}

		const nodes = result.data.allAgilityContent.nodes;

		return nodes;

	}
*/
	async queryContentItem({ contentID, languageCode }) {

		const nodeID = this.createNodeId(`agilitycontent-${contentID}-${languageCode}`);

		const contentNode = await this.getNode(nodeID);

		if (!contentNode || !contentNode.internal || !contentNode.internal.content) return null;

		const item = JSON.parse(contentNode.internal.content);

		return item;

		// const result = await graphql(`
		//   query ContentItemQuery {
		//     agilityContent(contentID: {eq: ${contentID}}, languageCode: {eq: "${languageCode}"}) {
		//       id
		//       internal {
		//         content
		//       }
		//     }
		//   }`);

		// if (result.errors) {
		// 	throw result.errors
		// }



		// return result.data;
	}


}


module.exports = {
	ContentResolver
}