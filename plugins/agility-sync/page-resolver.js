var { logDebug, logInfo, logError, logWarning, logSuccess, asyncForEach } = require('./plugin-util')


class PageResolver {


	constructor({ getNode, createNodeId }) {
		this.getNode = getNode;
		this.createNodeId = createNodeId;
		this.contentByID = {};
		this.contentByRefName = {};
		this.sitemapNodes = {};
	}


	async expandPage({ page }) {

		//loop the modules...
		const languageCode = page.languageCode;
		const pagePath = page.path;
		const pageID = page.pageID;

		let newZones = {};

		for (const zoneName in page.zones) {
			if (page.zones.hasOwnProperty(zoneName)) {
				const zone = page.zones[zoneName];
				let newZone = [];
				await asyncForEach(zone, async (module) => {

					const contentItem = await this.expandContentByID({ contentID: module.item.contentid, languageCode: languageCode, pageID: pageID, depth: 0 });
					if (contentItem != null) {
						//add this module's content item into the zone
						newZone.push(contentItem);
					}

				});
				newZones[zoneName] = newZone;
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

		page.zones = newZones;

		//grab the dynamic item if we can


		return page;

	}

	addContent({ content }) {

		const languageCode = content.languageCode;
		const contentID = content.contentID;
		const refName = content.properties.referenceName;

		if (!this.contentByID[languageCode]) {
			this.contentByID[languageCode] = {}
		}

		if (!this.contentByRefName[languageCode]) {
			this.contentByRefName[languageCode] = {}
		}

		this.contentByID[languageCode][contentID] = content;
		this.contentByRefName[languageCode][refName] = content;
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
	async expandContentByID({ contentID, languageCode, pageID, depth }) {

		logInfo(`Expand content - ${contentID} - ${languageCode}`);

		if (!this.contentByID[languageCode]) return null;

		let item = this.contentByID[languageCode][contentID];

		if (item == null) return null;

		//convert the object to JSON and back to avoid circular references...
		const json = JSON.stringify(item);
		item = JSON.parse(json);

		//HACK previous code... remove
		// const item = await this.queryContentItem({ contentID, languageCode });
		// if (item == null || item.internal == null) return null;
		// const json = item.internal.content;
		// if (json == null || json === "") return null;

		//track the dependency for this node...
		await this.addAgilityPageDependency({ pageID, contentID: contentID, languageCode: languageCode });

		return await this.expandContent({ contentItem: item, languageCode, pageID, depth });

	}

	/**
	 * Expand any linked content based on the json.
	 * @param {*} { item, languageCode, pageID, depth }
	 * @returns The expanded content item.
	 */
	async expandContent({ contentItem, languageCode, pageID, depth }) {

		//only traverse 3 levels deep
		if (depth < 3) {

			const agilityFields = contentItem.agilityFields;
			const newDepth = depth + 1;

			//*** loop all the fields */
			for (const fieldName in agilityFields) {
				if (agilityFields.hasOwnProperty(fieldName)) {
					let fieldValue = agilityFields[fieldName];

					//*** pull in the linked content by id */
					if (fieldValue.contentID && parseInt(fieldValue.contentID) > 0) {
						const linkedContentID = parseInt(fieldValue.contentID);
						console.log(`Found content id ${linkedContentID} in field ${fieldName}`, fieldValue);

						//expand this content item...
						const linkedContentItem = await this.expandContentByID({ contentID: linkedContentID, languageCode, pageID, depth: newDepth })
						if (linkedContentItem != null) {
							//attach it to the field value..
							fieldValue.item = linkedContentItem;
						}

					}

					//*** pull in the linked content by multiple ids */
					else if (fieldValue.sortids && fieldValue.sortids.split) {
						//pull in the linked content by multiple ids
						console.log(`Found content ids ${fieldValue.sortids} in field ${fieldName}`, fieldValue);

						const linkedContentItems = [];
						const linkedContentIDs = fieldValue.sortids.split(',');

						for (const i in linkedContentIDs) {
							const linkedContentID = parseInt(linkedContentIDs[i]);
							if (linkedContentID > 0) {
								//expand this content item...
								const linkedContentItem = await this.expandContentByID({ contentID: linkedContentID, languageCode, pageID, depth: newDepth })
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

						console.log(`Found content ref ${fieldValue.referencename} in field ${fieldName}`, fieldValue);

						const lst = await this.getContentItemsByRefName({ refName: fieldValue.referencename, languageCode });

						if (lst != null) {
							await asyncForEach(lst, async (listItem) => {

								const json = JSON.stringify(listItem);
								const thisItem = JSON.parse(json);

								//track the dependency for this node...
								await addAgilityPageDependency({ pageID, contentID: thisItem.contentID, languageCode: languageCode });

								let linkedContentItem = await expandContent({ contentItem: thisItem, languageCode, pageID, depth: newDepth });
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

	async addAgilityPageDependency({ pageID, contentID, languageCode }) {


		//track the dependency in GraphQL
		// const depNodeID = createNodeId(`agility-dep-${nodeId}`);
		// let depNode = await getNode(depNodeID);

		// let paths = [path];

		// if (depNode != null) {
		//   if (depNode.paths.indexOf(path) != -1) {
		//     //we already have a dependancy here, kick out
		//     return;
		//   }
		//   depNode.paths.push(path)
		//   paths = depNode.paths;
		// }

		// const obj = {
		//   contentID: contentID,
		//   languageCode: languageCode,
		//   paths: paths
		// };

		// const nodeMeta = {
		//   id: depNodeID,
		//   parent: null,
		//   children: [],
		//   internal: {
		//     type: `AgilityDependency`,
		//     content: "",
		//     contentDigest: createContentDigest(obj)
		//   }
		// }
		// depNode = Object.assign({}, obj, nodeMeta);

		// await createNode(depNode);

		//track the dependency in Gatsby...
		// const state = store.getState();
		// let paths = state.componentDataDependencies.nodes[nodeId];
		// if (!paths || (paths.indexOf && paths.indexOf(path) == -1)) {
		// 	//HACK await createPageDependency({ path, nodeId });
		// }

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

	async queryContentItem({ contentID, languageCode }) {


		const nodeID = this.createNodeId(`agilitycontent-${contentID}-${languageCode}`);

		const contentNode = await this.getNode(nodeID);
		return contentNode;

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
*/

}


module.exports = {
	PageResolver
}
