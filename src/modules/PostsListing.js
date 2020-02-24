import React, { Component } from 'react';
import { Link, graphql, StaticQuery } from 'gatsby'
import './PostListing.css'
import truncate from 'truncate-html'

export default props => (
	<StaticQuery
		query={graphql`
        query PostListingModuleQuery {
            allAgilityPost(
              filter: {
                properties: { referenceName: { eq: "posts"}}
              },
              limit: 10
            ) {
              totalCount
              nodes {
                contentID
                customFields {
                    title
                    details
                    image {
                        url
                    }

                }
                    properties {
                        referenceName
                    }
                }
            }
            allAgilitySitemapNode (
              filter: {
                contentID: {ne: -1}
              }
                ){
              nodes {
                contentID,
                path
              }
            }
          }
        `}
		render={queryData => {

			let posts = [];

			//get the dynamic URLs for each post
			queryData.allAgilityPost.nodes.forEach(post => {


				const sitemapNodeForPost = queryData.allAgilitySitemapNode.nodes.find(sitemapNode => {
					return post.contentID === sitemapNode.contentID;
				})



				post.dynamicUrl = sitemapNodeForPost.path;
				posts.push(post);
			})

			const viewModel = {
				item: props.item,
				posts: posts
			}
			return (
				<PostsListing {...viewModel} />
			);
		}}
	/>
)


/*
 category {
	item {
		customFields {
			title
		}
	}
}
author {
	item {
		customFields {
			name
		}
	}
}
*/

class PostsListing extends Component {
	renderPostExcerpt(html) {
		const excerpt = truncate(html, { stripTags: true, length: 160 });
		return { __html: excerpt };
	}
	renderPosts() {
		if (this.props.posts != null) {
			let posts = [];

			this.props.posts.forEach(post => {
				posts.push(
					<div className="post" key={post.contentID}>
						<Link to={post.dynamicUrl}>
							{post.customFields.image &&
								<img src={post.customFields.image.url + '?w=480'} alt={post.customFields.image.label} />
							}
							<h2>
								{post.customFields.title}
							</h2>
							{/* <div>{post.customFields.author.item.customFields.name} | {post.customFields.category.item.customFields.title}</div> */}
							<p dangerouslySetInnerHTML={this.renderPostExcerpt(post.customFields.details)}></p>
						</Link>
					</div>
				)
			})

			return posts;
		}
	}
	render() {

		return (


			< section className="posts-listing" >
				<div className="container">
					<h1>{this.props.item.customFields.title}</h1>
					<div className="posts-listing-container">
						{this.renderPosts()}
					</div>
				</div>
			</section >
		);
	}
}
