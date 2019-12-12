var agility = require('./content-fetch')
var path = require('path')
var { logDebug, logInfo, logError, logWarning, logSuccess, asyncForEach } = require('./plugin-util')
var { PageResolver } = require("./page-resolver")
var { graphql } = require("gatsby")

exports.sourceNodes = async (args, configOptions) => {
  const { actions, createNodeId, createContentDigest, getNode, getNodes, store, cache, reporter, webhookBody } = args;

  const pageResolver = new PageResolver({ getNode, createNodeId });

  logInfo(`Sync Started ...`);

  if (webhookBody && Object.keys(webhookBody).length > 0) {
    logSuccess(`Webhook being processed...`);
    logSuccess(JSON.stringify(webhookBody));
  }

  const { createNode, deleteNode, deletePage, touchNode } = actions
  // Create nodes here, generally by downloading data
  // from a remote API.

  const aglClient = agility.getApi({
    guid: configOptions.guid,
    apiKey: configOptions.apiKey,
    isPreview: configOptions.isPreview,
    debug: configOptions.debug,
    baseUrl: configOptions.baseUrl
  })

  const languages = configOptions.languages;
  const channels = configOptions.channels;

  // Source Sitemap + Pages ---------------------------------------------------------------------------
  const sourceSitemap = async ({ language }) => {

    const languageCode = language;

    logInfo(`Start Sitemap Sync - ${language} - ${JSON.stringify(channels)}`);
    //Loop through each channel
    await asyncForEach(channels, async (channel) => {

      const sitemapNodes = await aglClient.getSitemapFlat({ channelName: channel, languageCode: languageCode });

      if (!sitemapNodes) {
        logError(`Could not retrieve sitemap for ${channelName} (${languageCode}.`);
        return; //kickout
      }

      // Loop through each sitemapnode in sitemap
      await asyncForEach(Object.values(sitemapNodes), async (sitemapNode) => {

        // Add-in languageCode for this item so we can filter it by lang later
        sitemapNode.languageCode = languageCode;

        // Update the path to include languageCode (if multi-lingual site)
        if (configOptions.languages.length > 1) {
          sitemapNode.path = `/${languagePath}${sitemapNode.path}`;
        }

        // Now create a node for each sitemap entry as well

        // If we don't have a contentID property, add-in a negative value - this allows us to safely query for this property later...
        if (!sitemapNode.contentID) {
          sitemapNode.contentID = -1;
        }

        //stash this node in our temp cache for page resolving..
        pageResolver.addSitemapNode({ node: sitemapNode, languageCode });

        const sitemapNodeContent = JSON.stringify(sitemapNode);

        if (configOptions.debug) {
          logDebug(sitemapNodeContent);
        }


        let sitemapIDStr = `sitemap-${languageCode}-${sitemapNode.pageID}`;
        if (sitemapNode.contentID > 0) {
          //handle dynamic pages here....
          sitemapIDStr = `sitemap-${languageCode}-${sitemapNode.pageID}-${sitemapNode.contentID}`;
        }
        const sitemapNodeID = createNodeId(sitemapIDStr);

        const sitemapNodeMeta = {
          id: sitemapNodeID,
          parent: null,
          children: [],
          internal: {
            type: 'AgilitySitemap',
            content: "",
            contentDigest: createContentDigest(sitemapNode)
          }
        }
        const sitemapNodeToCreate = Object.assign({}, sitemapNode, sitemapNodeMeta);

        await createNode(sitemapNodeToCreate);

      })
    });

  }

  /**
   * Process a content item in the local graphql storage.
   * @param {The content item.} ci
   * @param {The language code of the item.} languageCode
   */
  const processContentItemNode = async (ci, languageCode) => {

    const nodeID = createNodeId(`agilitycontent-${ci.contentID}-${languageCode}`);
    const nodeIDRefName = createNodeId(`agilitycontentref-${ci.contentID}-${languageCode}`);

    if (ci.properties.state === 3) {
      //*****  handle deletes *****
      deleteNode({
        node: getNode(nodeID),
      });

      deleteNode({
        node: getNode(nodeIDRefName),
      });

      logSuccess(`${ci.contentID}-${languageCode} - node deleted.`)
    } else {
      //*****  handle creates or updates *****

      //switch `fields` to 'agilityFields' - (fields is a reserved name)
      ci.agilityFields = ci.fields;
      delete ci.fields;

      // Add-in languageCode for this item so we can filter it by lang later
      ci.languageCode = languageCode;

      //stash this item in the page resolver for later...
      pageResolver.addContent({ content: ci });

      const nodeContent = JSON.stringify(ci);

      if (configOptions.debug) {
        logDebug(nodeContent);
      }

      //create it once as an Item
      const nodeMeta = {
        id: nodeID,
        parent: null,
        children: [],
        internal: {
          type: `AgilityContent`, //_${ci.properties.definitionName}`,
          content: nodeContent,
          contentDigest: createContentDigest(ci)
        }
      }
      const node = Object.assign({}, ci, nodeMeta);


      await createNode(node);

      //create it a second time referenced by the content def

      const nodeMeta2 = {
        id: nodeIDRefName,
        parent: null,
        children: [],
        internal: {
          type: `AgilityContent_${ci.properties.definitionName}`,
          content: nodeContent,
          contentDigest: createContentDigest(ci)
        }
      }
      const node2 = Object.assign({}, ci, nodeMeta2);

      //create it once as an Item
      await createNode(node2);

    }

    //return any dependencies to the calling function...
    const state = store.getState();
    let paths = state.componentDataDependencies.nodes[nodeID];

    if (paths && paths.length) {
      return paths;
    }

    return [];

  }


  /**
  * Process a page item in the local graphql storage.
  * @param {The page item.} pageItem
  * @param {The language code of the item.} languageCode
  */
  const processPageNode = async (pageItem, languageCode) => {

    const nodeID = createNodeId(`agilitypage-${languageCode}-${pageItem.pageID}`);

    if (pageItem.properties.state === 3) {
      //*****  handle deletes *****
      deleteNode({
        node: getNode(nodeID)
      });

      logSuccess(`${pageItem.pageID}-${languageCode} - node deleted.`)
    } else {
      //*****  handle creates or updates *****

      //fix the zones property so it isn't a dictionary
      // if (pageItem.zones) {
      //   let pageZones = [];

      //   Object.keys(pageItem.zones).forEach((zoneName) => {
      //     const pageZone = {
      //       name: zoneName,
      //       modules: Object.values(pageItem.zones[zoneName])
      //     }
      //     pageZones.push(pageZone);
      //   });


      //   // Overwrite previous zones property
      //   pageItem.zones = pageZones;
      // }


      // Add-in languageCode for this item so we can filter it by lang later
      pageItem.languageCode = languageCode;

      //HACK: I don't think we need the sitemap node...
      // //grab the sitemap node for this page...
      // let sitemapIDStr = `sitemap-${languageCode}-${pageItem.pageID}`;
      // const sitemapNodeID = createNodeId(sitemapIDStr);
      // const sitemapNode = await getNode(sitemapNodeID);

      // if (sitemapNode == null) {
      //   logWarning(`Page with id ${pageItem.pageID} in lang ${languageCode} could not be found on the sitemap.`);
      //   return [];

      // }

      // pageItem.path = sitemapNode.path;

      //expand this page's modules and content out
      pageItem = await pageResolver.expandPage({ page: pageItem });

      const nodeContent = JSON.stringify(pageItem);

      if (configOptions.debug) {
        logDebug(nodeContent);
      }

      const nodeMeta = {
        id: nodeID,
        parent: null,
        children: [],
        pageID: pageItem.pageID,
        languageCode: languageCode,
        internal: {
          type: `AgilityPage`,
          content: nodeContent,
          contentDigest: createContentDigest(pageItem)
        }
      }
      //const node = Object.assign({}, pageItem, nodeMeta);

      await createNode(nodeMeta);


    }

    //return any dependencies to the calling function...
    const state = store.getState();
    let paths = state.componentDataDependencies.nodes[nodeID];

    if (paths && paths.length) {
      return paths;
    }

    return [];
  }

  /**
   * Sync all the content items in the specified language.
   */
  const syncAllContentItems = async ({ aglClient, language, syncState }) => {

    try {
      let ticks = 0;
      if (syncState && syncState.items[language]) {
        ticks = syncState.items[language].ticks;
      }


      do {
        //sync content items...
        const syncRet = await aglClient.syncContentItems({
          ticks: ticks,
          pageSize: 100,
          languageCode: language
        });

        const syncItems = syncRet.items;

        //if we don't get anything back, kick out
        if (syncItems.length === 0) {
          break;
        }

        for (let index = 0; index < syncItems.length; index++) {
          const thesePaths = await processContentItemNode(syncItems[index], language);

          thesePaths.forEach((value) => {
            if (syncState.dependantPaths.indexOf(value) == -1) syncState.dependantPaths.push(value);
          });

        }

        ticks = syncRet.ticks;
        logInfo(`Content Sync returned ${syncItems.length} items - ticks: ${ticks}`);

        if (!syncState.items[language]) syncState.items[language] = {};
        syncState.items[language].ticks = ticks;


      } while (ticks > 0)

    } catch (error) {
      if (console) console.error("Error occurred in content sync.", error);
    }

    return syncState;

  };

  /**
   * Sync all the pages in the specified language.
   */
  const syncAllPages = async ({ aglClient, language, syncState }) => {

    let pagesChanged = false;
    try {
      let ticks = 0;
      if (syncState && syncState.pages[language]) {
        ticks = syncState.pages[language].ticks;
      }

      do {
        //sync content items...
        const syncRet = await aglClient.syncPageItems({
          ticks: ticks,
          pageSize: 100,
          languageCode: language
        });

        const syncItems = syncRet.items;

        //if we don't get anything back, kick out
        if (syncItems.length === 0) {
          break;
        }

        //we've synced at least 1 page - source sitemap...
        await sourceSitemap({ language });

        pagesChanged = true;

        for (let index = 0; index < syncItems.length; index++) {

          let pageToProcess = syncItems[index];
          const thesePaths = await processPageNode(pageToProcess, language);

          thesePaths.forEach((value) => {
            if (syncState.dependantPaths.indexOf(value) == -1) syncState.dependantPaths.push(value);
          });

          syncState.pagesToUpdate.push({
            pageID: pageToProcess.pageID,
            languageCode: language
          });
        }


        ticks = syncRet.ticks;
        logInfo(`Page Sync returned ${syncItems.length} pages - ticks: ${ticks}`);

        if (!syncState.pages[language]) syncState.pages[language] = {};
        syncState.pages[language].ticks = ticks;


      } while (ticks > 0)

    } catch (error) {
      if (console) console.error("Error occurred in page sync.", error);
    }

    return {
      syncState, pagesChanged
    };

  };


  /**
   * Touch the previous nodes so that they don't get erased in this build
   */
  const touchAllNodes = async () => {

    let nodes = getNodes();

    let count = 0;
    await asyncForEach(nodes, async (node) => {
      //only touch the Agility nodes
      if (node.internal.type.indexOf("Agility") != -1) {
        await touchNode({ nodeId: node.id });
        count++;
      }
    });

    logSuccess(`Touched ${count} nodes`);

  }

  // DO THE WORK ----------------------------------------------------------------------------
  //Loop through each language


  const agilityCacheFolder = ".agility";
  const stateFilePath = `${agilityCacheFolder}/syncState.json`;

  /**
   * Save the sync state
   */
  const saveSyncState = async ({ syncState }) => {

    //{"items":{"en-us":{"ticks":309}},"pages":{"en-us":{"ticks":95}}}

    const nodeMeta = {
      id: "agilitysyncstate",
      parent: null,
      children: [],
      internal: {
        type: `AgilitySyncState`, //_${ci.properties.definitionName}`,
        content: "",
        contentDigest: createContentDigest(syncState)
      }
    }
    const node = Object.assign({}, syncState, nodeMeta);

    await createNode(node);



    // const p = new Promise((resolve, reject) => {
    //   try {

    //     const writeTheFile = async () => {
    //       const json = JSON.stringify(syncState);

    //       fs.writeFile(stateFilePath, json, (err) => {
    //         resolve;
    //       });
    //     };

    //     fs.stat(stateFilePath, (err, stats) => {

    //       if (!stats) {
    //         //create the folder...
    //         fs.mkdir(agilityCacheFolder, (err) => {
    //           writeTheFile();
    //         });
    //       } else {
    //         writeTheFile();
    //       }
    //     });

    //   } catch (err3) {
    //     console.error("Error occurred writing sync file", err3);
    //   }
    //   resolve();

    // });

    // return p;

  }

  const getSyncState = async () => {

    const syncNode = await getNode("agilitysyncstate");
    return syncNode;

    // const p = new Promise((resolve, reject) => {
    //   try {
    //     fs.stat(stateFilePath, (err, stats) => {
    //       if (stats) {
    //         fs.readFile(stateFilePath, (err2, data) => {
    //           if (data) {
    //             let obj = JSON.parse(data);
    //             resolve(obj);
    //           } else {
    //             resolve(null);
    //           }
    //         });
    //       } else {
    //         resolve(null);
    //       }
    //     });
    //   } catch (err3) {
    //     console.error("Error occurred reading sync file", err3);
    //     resolve(null);
    //   }

    // });

    // return p;

  }


  //**** DO THE WORK ****

  const doTheWork = async () => {

    //get the saved sync state
    let syncState = await getSyncState();

    if (!syncState) {
      syncState = {
        items: {},
        pages: {}
      };
    }

    //reset the pages that we have to update on this round...
    syncState.pagesToUpdate = [{ pageID: -1, languageCode: "" }];
    syncState.dependantPaths = [""];

    //mark all the previous nodes as touched so they don't get reset...
    await touchAllNodes();

    //loop all the languages...
    await asyncForEach(languages, async (language) => {

      logInfo(`Start Sync Content - ${language} - ${JSON.stringify(syncState.items)} `);
      syncState = await syncAllContentItems({ aglClient, language, syncState });
      logSuccess(`Done Sync Content - ${language} - ${JSON.stringify(syncState.items)} `);

      logInfo(`Start Sync Pages - ${language} - ${JSON.stringify(syncState.pages)} `);
      let pageSyncRet = await syncAllPages({ aglClient, language, syncState });
      syncState = pageSyncRet.syncState;
      logSuccess(`Done Page Sync - ${language} - ${JSON.stringify(syncState.pages)} - pages changed - ${pageSyncRet.pagesChanged}`);

      //persist the state to the file system
      await saveSyncState({ syncState });

      logInfo(`Done Sync - ${language}`);


    });

  };


  await doTheWork();

}


exports.createPages = async (args, configOptions) => {
  const { graphql, actions, getNode, createNodeId, createContentDigest, store } = args;
  const { createPage, deletePage, createNode, createRedirect, createPageDependency } = actions;

  logInfo(`Create Pages Started...`);

  let pageTemplate = null;
  if (configOptions.defaultPageTemplate) {
    pageTemplate = path.resolve(configOptions.defaultPageTemplate);
  }

  /**
   * Expands linked content given a page id.
   * @param {*} { contentID, languageCode, pageID, depth }
   * @returns
   */
  const expandContentByID = async ({ contentID, languageCode, path, depth }) => {

    logInfo(`Expand content - ${contentID} - ${languageCode}`);
    const item = await queryContentItem({ contentID, languageCode });

    if (item == null || item.agilityContent == null || item.agilityContent.internal == null) return null;

    const json = item.agilityContent.internal.content;

    if (json == null || json === "") return null;

    //track the dependency for this node...
    await addAgilityPageDependency({ path, nodeId: item.agilityContent.id, contentID: item.agilityContent.contentID, languageCode: languageCode });

    return await expandContent({ json, languageCode, path, depth });

  }

  /**
   * Expand any linked content based on the json.
   * @param {*} { json, languageCode, pageID, depth }
   * @returns The expanded content item.
   */
  const expandContent = async ({ json, languageCode, path, depth }) => {

    const contentItem = JSON.parse(json);

    //only traverse 5 levels deep
    if (depth < 5) {

      const newDepth = depth + 1;

      //*** loop all the fields */
      for (const fieldName in fields) {
        if (fields.hasOwnProperty(fieldName)) {
          let fieldValue = fields[fieldName];

          //*** pull in the linked content by id */
          if (fieldValue.contentID && parseInt(fieldValue.contentID) > 0) {
            const linkedContentID = parseInt(fieldValue.contentID);
            console.log(`Found content id ${linkedContentID} in field ${fieldName}`, fieldValue);

            //expand this content item...
            const linkedContentItem = await expandContentByID({ contentID: linkedContentID, languageCode, path, depth: newDepth })
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
                const linkedContentItem = await expandContentByID({ contentID: linkedContentID, languageCode, path, depth: newDepth })
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

            const lstNodes = await queryContentList({ referenceName: fieldValue.referencename, languageCode });
            const lst = [];

            await asyncForEach(lstNodes, async (nodeItem) => {

              var jsonItem = nodeItem.internal.content;

              //track the dependency for this node...
              await addAgilityPageDependency({ path, nodeId: nodeItem.id, contentID: nodeItem.contentID, languageCode: languageCode });

              let linkedContentItem = await expandContent({ json: jsonItem, languageCode, path, depth: newDepth });
              if (linkedContentItem != null) {
                lst.push(linkedContentItem);
              }

            });

            fieldValue.items = lst;

          }

        }

      }
    }


    return contentItem;
  }

  const addAgilityPageDependency = async ({ path, nodeId, contentID, languageCode }) => {


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
    const state = store.getState();
    let paths = state.componentDataDependencies.nodes[nodeId];
    if (!paths || (paths.indexOf && paths.indexOf(path) == -1)) {
      //HACK await createPageDependency({ path, nodeId });
    }

  }

  /**
   * Queries a content list and returns json for each item.
   *
   * @param {*} { referenceName, languageCode }
   */
  const queryContentList = async ({ referenceName, languageCode }) => {
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

  const queryContentItem = async ({ contentID, languageCode }) => {
    const result = await graphql(`
      query ContentItemQuery {
        agilityContent(contentID: {eq: ${contentID}}, languageCode: {eq: "${languageCode}"}) {
          id
          internal {
            content
          }
        }
      }`);

    if (result.errors) {
      throw result.errors
    }



    return result.data;
  }

  const queryPage = async ({ pageID, languageCode }) => {
    const result = await graphql(`
      query SitemapNodesQuery {
        agilityPage(pageID: {eq: ${pageID}}, languageCode: {eq: "${languageCode}"}) {
          id
          pageID
          excludeFromOutputCache
          languageCode
          menuText
          name
          pageType
          properties {
            modified
            state
            versionID
          }
          redirectUrl
          scripts {
            excludedFromGlobal
          }
          securePage
          seo {
            metaDescription
            metaHTML
            metaKeywords
          }
          templateName
          title
          visible {
            menu
            sitemap
          }
          zones {
            name
            modules {
              item {
                contentid
              }
              module
            }
          }
        }
      }`);

    if (result.errors) {
      throw result.errors
    }

    return result.data;
  };

  const querySitemapNodes = async ({ pageID, languageCode }) => {
    const result = await graphql(`query SitemapNodesQuery {
        allAgilitySitemap(filter: {pageID: {eq: ${pageID}}, languageCode: {eq: "${languageCode}"}}) {
          nodes {
            name
            contentID
            pageID
            path
            title
            menuText
            languageCode
          }
        }
      }`);

    if (result.errors) {
      throw result.errors
    }

    return result.data;
  };

  const queryAllSitemapNodes = async () => {
    const result = await graphql(`query SitemapNodesQuery {
        allAgilitySitemap {
          nodes {
            name
            contentID
            pageID
            path
            title
            menuText
            languageCode
          }
        }
      }`);

    if (result.errors) {
      throw result.errors
    }

    return result.data;
  };

  const querySitemapNodeByPath = async ({ path, languageCode }) => {
    const result = await graphql(`query SitemapNodesPathQuery {
        allAgilitySitemap(filter: {path: {eq: "${path}"}, languageCode: {eq: "${languageCode}"}}) {
          nodes {
            name
            contentID
            pageID
            path
            title
            menuText
            languageCode
          }
        }
      }`);

    if (result.errors) {
      throw result.errors
    }

    return result.data;
  };

  const querySitemapNodeCount = async () => {
    const result = await graphql(`query allSitePageCountQuery {
        allSitePage {
          totalCount
        }
      }`);

    if (result.errors) {
      throw result.errors
    }

    return result.data.allSitePage.totalCount;
  };


  const querySyncState = async () => {
    const result = await graphql(`query SyncStateQuery {
      agilitySyncState(id: {eq: "agilitysyncstate"}) {
          dependantPaths
          pagesToUpdate {
            pageID
            languageCode
          }
        }
      }`);

    if (result.errors) {
      throw result.errors
    }

    return result.data;
  };

  const createAgilityPage = async (sitemapNode) => {

    if (sitemapNode.isFolder) return;

    let languageCode = sitemapNode.languageCode;
    let pagePath = sitemapNode.path;

    // Do we have this page in other languages? If so, add-in some info for them so they can be found/accessed easily

    //HACK is this neccessary?
    // sitemapNode.nodesInOtherLanguages = [];
    // if (configOptions.languages.length > 1) {
    //   result.data.allAgilitySitemapNode.nodes.forEach(smn => {
    //     // If we found a page with the same ID and its NOT this same page
    //     if (smn.pageID === sitemapNode.pageID && smn.languageCode !== sitemapNode.languageCode) {

    //       let languageForThisOtherNode = configOptions.languages.find(l => {
    //         return l.code === smn.languageCode
    //       })

    //       sitemapNode.nodesInOtherLanguages.push({
    //         name: smn.name,
    //         pageID: smn.pageID,
    //         path: smn.path,
    //         menuText: smn.menuText,
    //         languageName: languageForThisOtherNode.name,
    //         languageCode: languageForThisOtherNode.code
    //       });
    //     }
    //     return;
    //   })
    // }

    let createPageArgs = {
      path: pagePath,
      component: pageTemplate,
      context: {
        pageID: sitemapNode.pageID,
        contentID: sitemapNode.contentID,
        languageCode: sitemapNode.languageCode
      }
    }

    let languageForThisPage = configOptions.languages.find(lang => {
      return lang === sitemapNode.languageCode
    })

    if (!languageForThisPage) {
      logError(`The language for the page ${pagePath} with languageCode ${languageCode} could not be found.`);
      return; //kickout
    }

    let homePagePath = languageForThisPage.homePagePath;

    if (configOptions.languages.length > 1) {
      homePagePath = `/ ${languageForThisPage.path} ${languageForThisPage.homePagePath} `;
    }

    // if (homePagePath && homePagePath === pagePath) {

    //   logInfo(`Found homepage for ${languageForThisPage.code}(${homePagePath}) in sitemap.`)

    //   if (configOptions.languages.length > 1) {
    //     createPageArgs.path = `/ ${languageForThisPage.path}`
    //   } else {
    //     createPageArgs.path = `/ `
    //   }

    //   createPage(createPageArgs);

    //   if (configOptions.debug) {
    //     logDebug(JSON.stringify(createPageArgs));
    //   }

    //   logSuccess(`Index Page ${createPageArgs.path} (${sitemapNode.languageCode}) created.`);

    //   //create a redirect from the actual page to the root page
    //   createRedirect({
    //     fromPath: pagePath,
    //     toPath: createPageArgs.path,
    //     isPermantent: true,
    //     redirectInBrowser: true
    //   });

    //   logSuccess(`Redirect from ${pagePath} to ${createPageArgs.path} created`);

    // } else {

    createPage(createPageArgs);

    if (configOptions.debug) {
      logDebug(JSON.stringify(createPageArgs));
    }

    // logSuccess(`Page ${createPageArgs.path} (${sitemapNode.languageCode}) created.`);
    //}

  }

  const syncState = await querySyncState();

  const sitemapNodes = await queryAllSitemapNodes();
  if (sitemapNodes == null) {
    logWarning(`Could not get all sitemap node(s)`)
    return;
  }

  //loop all nodes we returned...

  await asyncForEach(sitemapNodes.allAgilitySitemap.nodes, async (sitemapNode) => {
    await createAgilityPage(sitemapNode);
  });

  // Create default language path redirect (if required)
  // if (configOptions.languages.length > 1) {
  //   const defaultLanguage = configOptions.languages[0];
  //   createRedirect({
  //     fromPath: '/',
  //     toPath: `/ ${defaultLanguage.path} `,
  //     isPermantent: true,
  //     redirectInBrowser: true
  //   })
  //   logSuccess(`Redirect created for default language path from / to ${defaultLanguage.path} `)
  // }

  logInfo(`Pages created.`)

}

exports.onCreateNode = ({ node, actions }) => {


}








