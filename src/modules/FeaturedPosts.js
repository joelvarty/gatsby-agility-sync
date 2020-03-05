import React, { Component } from 'react';
import { Link, graphql, StaticQuery } from 'gatsby'
import './PostListing.css'
import truncate from 'truncate-html'

export default props => (
	<StaticQuery
		query={graphql`
        query FeaturedPostModuleQuery {
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

			let posts = props.item.customFields.posts;

			//get the dynamic URLs for each post
			posts.forEach(post => {
				const sitemapNodeForPost = queryData.allAgilitySitemapNode.nodes.find(sitemapNode => {
					return post.contentID === sitemapNode.contentID;
				})
				post.dynamicUrl = sitemapNodeForPost.path;
			})

			const viewModel = {
				item: props.item,
				posts: posts
			}
			return (
				<FeaturedPosts {...viewModel} />
			);
		}}
	/>
)

class FeaturedPosts extends Component {
	renderPostExcerpt(html) {
		const excerpt = truncate(html, { stripTags: true, length: 160 });
		return { __html: excerpt };
	}
	renderPosts() {
		if (this.props.posts) {
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
							<div>{post.customFields.author.customFields.name} | {post.customFields.category.customFields.title}</div>
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
						{this.props.item.customFields.posts.referenceName}
						{this.renderPosts()}
					</div>
				</div>
			</section >
		);
	}
}
