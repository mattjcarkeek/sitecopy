import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Clipboard } from '@angular/cdk/clipboard';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import axios from 'axios';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  url: string = '';
  scrapedContent: string = '';
  imageUrls: string[] = [];
  scrapeSuccess: boolean = false;
  clipboardMessage: string = '';
  loading: boolean = false;
  videoUrls: { type: 'vimeo' | 'wordpress', url: string }[] = [];

  private http = inject(HttpClient);
  private clipboard = inject(Clipboard);

  async scrapeWebsite() {
    this.loading = true;
    try {
      const response = await axios.get(`https://corsproxy.io/?${encodeURIComponent(this.url)}`, {
        headers: {
          'Accept': 'text/html'
        }
      });
      
      const html = response.data;
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const mainContent = doc.querySelector('main');
      if (mainContent) {
        const h1Content = mainContent.querySelector('h1.post-title')?.outerHTML || '';
        const articleContent = mainContent.querySelector('article')?.innerHTML || '';
        
        let combinedContent = h1Content + articleContent;
        
        combinedContent = combinedContent.replace(/\b(?<!Manage My )Nightlife\b/g, "AMS Nightlife");
        
        this.scrapedContent = combinedContent;
        
        const mainImage = mainContent.querySelector('img.wp-post-image') || 
                          mainContent.querySelector('article img') ||
                          doc.querySelector('img');

        let mainImageSrc = '';
        if (mainImage) {
          const src = mainImage.getAttribute('src') || mainImage.getAttribute('data-src');
          if (src && src.startsWith('http')) {
            mainImageSrc = src;
            console.log(`Found main image: ${src}`);
          } else {
            console.log('Main image found but src is invalid');
          }
        } else {
          console.log('No main image found');
        }

        const figureImages = Array.from(mainContent.querySelectorAll('figure img')).map(img => 
          img.getAttribute('data-src') || img.getAttribute('src') || ''
        );

        const uniqueImageUrls = new Set<string>();

        if (mainImageSrc) {
          uniqueImageUrls.add(mainImageSrc);
        }

        figureImages.forEach(src => {
          if (src.startsWith('http')) {
            uniqueImageUrls.add(src);
          }
        });

        this.imageUrls = Array.from(uniqueImageUrls)
          .map(src => `https://corsproxy.io/?${encodeURIComponent(src)}`);

        console.log(`Found ${this.imageUrls.length} unique valid images in total`);

        const iframes = doc.querySelectorAll('iframe');
        const videos = doc.querySelectorAll('video');
        this.videoUrls = [];

        iframes.forEach(iframe => {
          const src = iframe.getAttribute('src') || iframe.getAttribute('data-src');
          if (src) {
            const transformedUrl = this.transformUrl(src);
            if (transformedUrl) {
              this.videoUrls.push({ type: 'vimeo', url: transformedUrl });
            }
          }
        });

        videos.forEach(video => {
          const dataSrc = video.getAttribute('data-src');
          if (dataSrc) {
            this.videoUrls.push({ type: 'wordpress', url: dataSrc });
          }
        });

        console.log(`Found ${this.videoUrls.length} video URLs`);
      } else {
        throw new Error('Main content not found');
      }
      
      this.scrapeSuccess = true;
      this.clipboardMessage = 'Scraping completed';
    } catch (error) {
      console.error('Error:', error);
      this.scrapeSuccess = false;
      this.clipboardMessage = 'Error occurred while scraping';
    } finally {
      this.loading = false;
    }
  }

  copyHtmlToClipboard() {
    this.clipboard.copy(this.scrapedContent);
    this.clipboardMessage = 'HTML copied to clipboard';
  }

  downloadAllImages() {
    this.imageUrls.forEach((url) => {
      fetch(url)
        .then(response => response.blob())
        .then(blob => {
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          
          const decodedUrl = decodeURIComponent(url);
          const filename = decodedUrl.substring(decodedUrl.lastIndexOf('/') + 1);
          link.download = filename;
          
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        });
    });
  }

  resetPage() {
    window.location.reload();
  }

  private transformUrl(url: string): string {
    const regex = /https:\/\/player\.vimeo\.com\/video\/(\d+)(?:\?h=([^&]+))?/;
    const match = url.match(regex);
    if (match) {
      return `https://vimeo.com/${match[1]}${match[2] ? '/' + match[2] : ''}`;
    }
    return '';
  }

  copyVideoUrl(url: string) {
    this.clipboard.copy(url);
    this.clipboardMessage = 'Video URL copied to clipboard';
  }

  openWordPressVideo(url: string) {
    window.open(url, '_blank');
  }
}
