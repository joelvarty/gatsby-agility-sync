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

			let posts = props.item.fields.posts;

			//get the dynamic URLs for each post
			posts.forEach(post => {
				const sitemapNodeForPost = queryData.allAgilitySitemapNode.nodes.find(sitemapNode => {
					return post.contentID === sitemapNode.contentID;
				})
				post.dynamicUrl = sitemapNodeForPost.path;
			})
			console.log("featured posts", posts);
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
							{post.fields.image &&
								<img src={post.fields.image.url + '?w=480'} alt={post.fields.image.label} />
							}
							<h2>
								{post.fields.title}
							</h2>
							<div>{post.fields.author.fields.name} | {post.fields.category.fields.title}</div>
							<p dangerouslySetInnerHTML={this.renderPostExcerpt(post.fields.details)}></p>
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
					<h1>{this.props.item.fields.title}</h1>
					<div className="posts-listing-container">
						{this.props.item.fields.posts.referenceName}
						{this.renderPosts()}
					</div>
				</div>
			</section >
		);
	}
}
